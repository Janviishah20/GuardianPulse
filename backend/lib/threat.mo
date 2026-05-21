import List "mo:core/List";
import Text "mo:core/Text";

module {
  // Gemini 1.5 Flash Latest REST endpoint (v1)
  public func geminiUrl(apiKey : Text) : Text {
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=" # apiKey
  };

  // Gemini 1.5 Pro Latest REST endpoint (v1) — fallback model
  public func geminiProUrl(apiKey : Text) : Text {
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=" # apiKey
  };

  // JSON body for audio classification via Gemini multimodal endpoint
  public func buildClassifyAudioBody(audioBase64 : Text, mimeType : Text) : Text {
    "{\"contents\":[{\"parts\":[{\"inline_data\":{\"mime_type\":\"" # mimeType # "\",\"data\":\"" # audioBase64 # "\"}},{\"text\":\"Analyse this audio file. Identify: 1) threat type: exactly one of fire, gas, structural, none. 2) confidence score: integer 0-100. 3) severity level: exactly one of low, medium, high. Return ONLY valid JSON: {\\\"threatType\\\": \\\"fire\\\", \\\"confidence\\\": 94, \\\"severity\\\": \\\"high\\\"}\"}]}]}"
  };

  // JSON body for image fire/smoke detection via Gemini Vision multimodal endpoint
  public func buildClassifyImageBody(imageBase64 : Text, mimeType : Text) : Text {
    "{\"contents\":[{\"parts\":[{\"inline_data\":{\"mime_type\":\"" # mimeType # "\",\"data\":\"" # imageBase64 # "\"}},{\"text\":\"You are a fire detection AI. Analyze this image for fire, smoke, or heat signatures. Respond ONLY with valid JSON: {\\\"fireDetected\\\": true, \\\"confidence\\\": 85, \\\"description\\\": \\\"brief description\\\"}\"}]}]}"
  };

  // JSON body for generating a calm evacuation instruction via Gemini
  public func buildEvacuationBody(roomId : Text, path : [Text]) : Text {
    let pathArr = path;
    var pathStr = "";
    var first = true;
    for (segment in pathArr.values()) {
      if (first) { pathStr := segment; first := false }
      else { pathStr := pathStr # " -> " # segment };
    };
    let prompt = "Generate a calm, direct 2-sentence evacuation instruction for a guest in Room " # roomId # " whose safe path is " # pathStr # ". Use encouraging, reassuring tone. Do not mention danger directly.";
    "{\"contents\":[{\"parts\":[{\"text\":\"" # escapeJson(prompt) # "\"}]}]}"
  };

  // Google Cloud TTS REST endpoint
  public func ttsUrl(apiKey : Text) : Text {
    "https://texttospeech.googleapis.com/v1/text:synthesize?key=" # apiKey
  };

  // JSON body for Google Cloud TTS with SSML (speaking rate 0.8, pitch -4st)
  public func buildTTSBody(text : Text) : Text {
    let ssml = "<speak><prosody rate=\"0.8\" pitch=\"-4st\">" # escapeJson(text) # "</prosody></speak>";
    "{\"input\":{\"ssml\":\"" # ssml # "\"},\"voice\":{\"languageCode\":\"en-US\",\"name\":\"en-US-Neural2-C\"},\"audioConfig\":{\"audioEncoding\":\"MP3\"}}"
  };

  // Extract the first text value from a Gemini response JSON.
  // Gemini response shape: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
  public func parseGeminiTextResponse(responseBody : Text) : Text {
    let marker = "\"text\":\"";
    switch (indexOfSubtext(responseBody, marker)) {
      case null { responseBody };
      case (?start) {
        let after = textSliceFrom(responseBody, start + marker.size());
        extractUntilQuote(after)
      };
    }
  };

  // Extract JSON object from Gemini text response (handles ```json ... ``` fences)
  public func parseGeminiJsonResponse(responseBody : Text) : Text {
    let textContent = parseGeminiTextResponse(responseBody);
    stripCodeFences(textContent)
  };

  // ── Private helpers ───────────────────────────────────────────

  func escapeJson(s : Text) : Text {
    s
      .replace(#char '\\', "\\\\")
      .replace(#char '\"',  "\\\"")
      .replace(#char '\n', "\\n")
      .replace(#char '\r', "\\r")
  };

  func indexOfSubtext(haystack : Text, needle : Text) : ?Nat {
    let hArr = haystack.toArray();
    let nArr = needle.toArray();
    let hLen = hArr.size();
    let nLen = nArr.size();
    if (nLen == 0) { return ?0 };
    if (hLen < nLen) { return null };
    var i = 0;
    label outer while (i + nLen <= hLen) {
      var match = true;
      var j = 0;
      while (j < nLen) {
        if (hArr[i + j] != nArr[j]) { match := false };
        j += 1;
      };
      if (match) { return ?i };
      i += 1;
    };
    null
  };

  func textSliceFrom(s : Text, from : Nat) : Text {
    let arr = s.toArray();
    if (from >= arr.size()) { return "" };
    Text.fromArray(arr.sliceToArray(from, arr.size()))
  };

  func extractUntilQuote(s : Text) : Text {
    let arr = s.toArray();
    let result = List.empty<Char>();
    var i = 0;
    var escaped = false;
    label scanning while (i < arr.size()) {
      let c = arr[i];
      if (escaped) {
        result.add(c);
        escaped := false;
      } else if (c == '\\') {
        result.add(c);
        escaped := true;
      } else if (c == '\"') {
        break scanning;
      } else {
        result.add(c);
      };
      i += 1;
    };
    Text.fromArray(result.toArray())
  };

  func stripCodeFences(s : Text) : Text {
    let trimmed = s.trim(#char ' ').trim(#char '\n');
    let jsonFence = "```json";
    let plainFence = "```";
    var inner = trimmed;
    if (inner.startsWith(#text jsonFence)) {
      inner := textSliceFrom(inner, jsonFence.size());
    } else if (inner.startsWith(#text plainFence)) {
      inner := textSliceFrom(inner, plainFence.size());
    };
    if (inner.endsWith(#text plainFence)) {
      let arr = inner.toArray();
      inner := Text.fromArray(arr.sliceToArray(0, arr.size() - plainFence.size()));
    };
    inner.trim(#char '\n').trim(#char ' ')
  };
};
