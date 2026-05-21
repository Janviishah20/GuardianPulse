import OutCall "mo:caffeineai-http-outcalls/outcall";
import ThreatTypes "../types/threat";
import ThreatLib "../lib/threat";
import Time "mo:core/Time";
import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

// Mixin: threat detection, evacuation messaging, and TTS via http-outcalls
mixin () {
  var latestThreat : ?ThreatTypes.ThreatResult = null;
  var geminiApiKey : Text = "";
  var googleTtsApiKey : Text = "";

  // Set API keys (called once by admin during setup)
  public func setGeminiApiKey(key : Text) : async () {
    geminiApiKey := key;
  };

  public func setGoogleTtsApiKey(key : Text) : async () {
    googleTtsApiKey := key;
  };

  // IC transform callback required by the http-outcalls module
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input)
  };

  // Classify audio via Gemini 1.5 Flash Latest (with fallback to Pro Latest).
  public func classifyAudio(audioBase64 : Text, mimeType : Text) : async { #ok : ThreatTypes.ThreatResult; #err : Text } {
    if (geminiApiKey == "") { return #err "GEMINI_API_KEY not configured — call setGeminiApiKey first" };
    let headers = [
      { name = "Content-Type"; value = "application/json" },
      { name = "Authorization"; value = "Bearer " # geminiApiKey },
    ];
    let body = ThreatLib.buildClassifyAudioBody(audioBase64, mimeType);

    // Primary attempt: gemini-1.5-flash-latest
    let primaryResult = try {
      let raw = await OutCall.httpPostRequest(ThreatLib.geminiUrl(geminiApiKey), headers, body, transform);
      ?raw
    } catch (_) { null };

    let rawResponse = switch (primaryResult) {
      case (?r) r;
      case null {
        // Fallback: gemini-1.5-pro-latest
        try {
          await OutCall.httpPostRequest(ThreatLib.geminiProUrl(geminiApiKey), headers, body, transform)
        } catch (e) {
          return #err "AI service temporarily unavailable. Please try again."
        }
      };
    };

    // Surface API-level errors (non-200 JSON error bodies)
    if (rawResponse.size() > 0 and not isGeminiSuccess(rawResponse)) {
      return #err "AI service temporarily unavailable. Please try again."
    };

    let jsonText = ThreatLib.parseGeminiJsonResponse(rawResponse);
    let threatType     = extractJsonField(jsonText, "threatType");
    let severityVal    = extractJsonField(jsonText, "severity");
    let confidenceText = extractJsonField(jsonText, "confidence");
    let confidence : Nat = switch (Nat.fromText(confidenceText)) {
      case (?n) n;
      case null 0;
    };
    let result : ThreatTypes.ThreatResult = {
      threatType  = if (threatType == "") "none" else threatType;
      confidence;
      severity    = if (severityVal == "") "none" else severityVal;
      rawResponse;
      timestamp   = Time.now();
    };
    latestThreat := ?result;
    #ok result
  };

  // Classify an image frame via Gemini 1.5 Flash Latest Vision (with fallback to Pro Latest).
  // imageBase64: base64-encoded image data; mimeType: e.g. "image/jpeg" or "image/png"
  // Returns ThreatResult: if fire detected → threatType="fire", severity from confidence; else threatType="none"
  public func classifyImage(imageBase64 : Text, mimeType : Text, roomId : Text) : async { #ok : ThreatTypes.ThreatResult; #err : Text } {
    if (geminiApiKey == "") { return #err "GEMINI_API_KEY not configured — call setGeminiApiKey first" };
    let headers = [
      { name = "Content-Type"; value = "application/json" },
      { name = "Authorization"; value = "Bearer " # geminiApiKey },
    ];
    let body = ThreatLib.buildClassifyImageBody(imageBase64, mimeType);

    // Primary attempt: gemini-1.5-flash-latest
    let primaryResult = try {
      let raw = await OutCall.httpPostRequest(ThreatLib.geminiUrl(geminiApiKey), headers, body, transform);
      ?raw
    } catch (_) { null };

    let rawResponse = switch (primaryResult) {
      case (?r) r;
      case null {
        // Fallback: gemini-1.5-pro-latest
        try {
          await OutCall.httpPostRequest(ThreatLib.geminiProUrl(geminiApiKey), headers, body, transform)
        } catch (e) {
          return #err "AI vision service temporarily unavailable. Please try again."
        }
      };
    };

    // Surface API-level errors (non-200 JSON error bodies)
    if (rawResponse.size() > 0 and not isGeminiSuccess(rawResponse)) {
      return #err "AI vision service temporarily unavailable. Please try again."
    };

    let jsonText = ThreatLib.parseGeminiJsonResponse(rawResponse);
    let fireDetectedStr = extractJsonField(jsonText, "fireDetected");
    let fireDetected = fireDetectedStr == "true";
    let confidenceText = extractJsonField(jsonText, "confidence");
    let confidence : Nat = switch (Nat.fromText(confidenceText)) {
      case (?n) n;
      case null 0;
    };

    let (threatType, severity) = if (fireDetected) {
      let sev = if (confidence >= 85) "critical"
                else if (confidence >= 70) "high"
                else if (confidence >= 50) "medium"
                else "low";
      ("fire", sev)
    } else {
      ("none", "none")
    };

    let result : ThreatTypes.ThreatResult = {
      threatType;
      confidence;
      severity;
      rawResponse;
      timestamp = Time.now();
    };
    latestThreat := ?result;
    #ok result
  };

  // Return the most recently stored ThreatResult
  public query func getLatestThreat() : async ?ThreatTypes.ThreatResult {
    latestThreat
  };

  // ── Simulator ─────────────────────────────────────────────────

  // Returns the caller's Principal as Text (useful for debugging and auth flows)
  public shared query ({ caller }) func whoami() : async Text {
    caller.toText()
  };

  // Inject a fake fire ThreatResult without calling Gemini (for demo/testing)
  public func simulateFire(roomId : Text) : async () {
    let result : ThreatTypes.ThreatResult = {
      threatType  = "fire";
      confidence  = 95;
      severity    = "critical";
      rawResponse = "[SIMULATED] Fire detected in specified room: " # roomId;
      timestamp   = Time.now();
    };
    latestThreat := ?result;
  };

  // Returns the current simulated (or real) threat, if any
  public query func getSimulatorState() : async ?ThreatTypes.ThreatResult {
    latestThreat
  };

  // Clears the simulated threat and resets latestThreat to null
  public func resetSimulator() : async () {
    latestThreat := null;
  };

  // Generate a calm 2-sentence evacuation instruction via Gemini text endpoint (with fallback)
  public func generateEvacuationInstruction(roomId : Text, path : [Text]) : async { #ok : Text; #err : Text } {
    if (geminiApiKey == "") { return #err "GEMINI_API_KEY not configured — call setGeminiApiKey first" };
    let headers = [
      { name = "Content-Type"; value = "application/json" },
      { name = "Authorization"; value = "Bearer " # geminiApiKey },
    ];
    let body = ThreatLib.buildEvacuationBody(roomId, path);

    // Primary attempt: gemini-1.5-flash-latest
    let primaryResult = try {
      let raw = await OutCall.httpPostRequest(ThreatLib.geminiUrl(geminiApiKey), headers, body, transform);
      ?raw
    } catch (_) { null };

    let rawResponse = switch (primaryResult) {
      case (?r) r;
      case null {
        // Fallback: gemini-1.5-pro-latest
        try {
          await OutCall.httpPostRequest(ThreatLib.geminiProUrl(geminiApiKey), headers, body, transform)
        } catch (e) {
          return #err "AI service temporarily unavailable. Please try again."
        }
      };
    };

    if (rawResponse.size() > 0 and not isGeminiSuccess(rawResponse)) {
      return #err "AI service temporarily unavailable. Please try again."
    };

    #ok (ThreatLib.parseGeminiTextResponse(rawResponse))
  };

  // Synthesise calm speech via Google Cloud TTS (SSML rate=slow, pitch=-4st)
  // Returns base64-encoded MP3 audio for browser playback
  public func generateTTS(text : Text) : async { #ok : Text; #err : Text } {
    if (googleTtsApiKey == "") { return #err "GOOGLE_TTS_API_KEY not configured — call setGoogleTtsApiKey first" };
    let url  = ThreatLib.ttsUrl(googleTtsApiKey);
    let body = ThreatLib.buildTTSBody(text);
    try {
      let rawResponse = await OutCall.httpPostRequest(url, [{ name = "Content-Type"; value = "application/json" }], body, transform);
      // Response: {"audioContent":"BASE64..."}
      let audioB64 = extractJsonField(rawResponse, "audioContent");
      if (audioB64 == "") {
        #err ("TTS response missing audioContent: " # rawResponse)
      } else {
        #ok audioB64
      }
    } catch (e) {
      #err ("TTS error: " # e.message())
    }
  };

  // ── Private helpers ───────────────────────────────────────────
  // Returns false if the Gemini response body contains a top-level "error" key
  // (indicating a 4xx/5xx API error) so we can surface a user-friendly message.
  func isGeminiSuccess(body : Text) : Bool {
    let marker = "\"error\"";
    let bodyArr = body.toArray();
    switch (findSubarray(bodyArr, marker.toArray())) {
      case (?_) false;
      case null true;
    }
  };
  // Extract a simple string or number field value from a flat JSON object.
  func extractJsonField(json : Text, fieldName : Text) : Text {
    let strMarker = "\"" # fieldName # "\":\"";
    let numMarker = "\"" # fieldName # "\":";
    let jsonArr = json.toArray();

    // Try string field first (quoted value)
    switch (findSubarray(jsonArr, strMarker.toArray())) {
      case (?start) {
        return readUntilQuote(jsonArr, start + strMarker.size());
      };
      case null {};
    };

    // Try numeric / boolean field
    switch (findSubarray(jsonArr, numMarker.toArray())) {
      case (?start) {
        return readUntilDelimiter(jsonArr, start + numMarker.size());
      };
      case null {};
    };

    ""
  };

  func findSubarray(haystack : [Char], needle : [Char]) : ?Nat {
    let hLen = haystack.size();
    let nLen = needle.size();
    if (nLen == 0) { return ?0 };
    if (hLen < nLen) { return null };
    var i = 0;
    label search while (i + nLen <= hLen) {
      var match = true;
      var j = 0;
      while (j < nLen) {
        if (haystack[i + j] != needle[j]) { match := false };
        j += 1;
      };
      if (match) { return ?i };
      i += 1;
    };
    null
  };

  func readUntilQuote(arr : [Char], from : Nat) : Text {
    let buf = List.empty<Char>();
    var i = from;
    label readQuote while (i < arr.size()) {
      let c = arr[i];
      if (c == '\"') { break readQuote };
      buf.add(c);
      i += 1;
    };
    Text.fromArray(buf.toArray())
  };

  func readUntilDelimiter(arr : [Char], from : Nat) : Text {
    let buf = List.empty<Char>();
    var i = from;
    label readDelim while (i < arr.size()) {
      let c = arr[i];
      if (c == ',' or c == '}' or c == ']' or c == ' ' or c == '\n') { break readDelim };
      buf.add(c);
      i += 1;
    };
    Text.fromArray(buf.toArray())
  };
};
