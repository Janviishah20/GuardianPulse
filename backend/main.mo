import Map "mo:core/Map";
import FloorplanMixin "mixins/floorplan-api";
import ThreatMixin "mixins/threat-api";

actor {
  // --- State ---
  let occupancy : Map.Map<Text, Bool> = Map.empty<Text, Bool>();

  // --- Mixins ---
  include FloorplanMixin(occupancy);
  include ThreatMixin();
};
