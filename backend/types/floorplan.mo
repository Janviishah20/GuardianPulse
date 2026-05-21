module {
  // A single room in the building floor plan
  public type RoomData = {
    id         : Text;         // e.g. "305"
    floor      : Nat;          // 1, 2, or 3
    name       : Text;         // human-readable, e.g. "Room 305"
    cameraId   : Text;         // e.g. "3B"
    neighbors  : [Text];       // adjacent room IDs for A* graph edges
    isExit     : Bool;         // true for stairwells / exit doors
    isCorridor : Bool;         // true for corridor nodes
  };

  // Occupancy state stored per room
  public type OccupancyState = {
    roomId   : Text;
    occupied : Bool;
  };
};
