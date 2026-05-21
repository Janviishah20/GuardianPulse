module {
  // Result of Gemini acoustic analysis
  public type ThreatResult = {
    threatType   : Text;   // "fire" | "gas" | "structural" | "none"
    confidence   : Nat;    // 0-100
    severity     : Text;   // "low" | "medium" | "high" | "none"
    rawResponse  : Text;   // full Gemini JSON response tunnelled to frontend
    timestamp    : Int;    // Time.now() at detection
  };
};
