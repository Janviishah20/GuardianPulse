import Map "mo:core/Map";
import List "mo:core/List";
import FloorplanTypes "../types/floorplan";
import FloorplanLib "../lib/floorplan";

// Mixin: floor plan read/write and A* routing
mixin (
  occupancy : Map.Map<Text, Bool>,
) {
  // Return the full static floor plan
  public query func getFloorPlan() : async [FloorplanTypes.RoomData] {
    FloorplanLib.buildFloorPlan()
  };

  // Mark a room as occupied or not
  public func setOccupied(roomId : Text, occupied : Bool) : async () {
    occupancy.add(roomId, occupied);
  };

  // Return IDs of all currently occupied rooms
  public query func getOccupiedRooms() : async [Text] {
    let result = List.empty<Text>();
    for ((roomId, isOccupied) in occupancy.entries()) {
      if (isOccupied) { result.add(roomId) };
    };
    result.toArray()
  };

  // Run A* from startRoom, treating blockedRooms as impassable
  public query func computeEscapePath(startRoom : Text, blockedRooms : [Text]) : async { #ok : [Text]; #err : Text } {
    let floorPlan = FloorplanLib.buildFloorPlan();
    FloorplanLib.computeEscapePath(floorPlan, startRoom, blockedRooms)
  };
};
