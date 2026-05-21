import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Types "../types/floorplan";

module {
  // Returns the full static floor plan (24 rooms + 3 corridors across 3 floors)
  public func buildFloorPlan() : [Types.RoomData] {
    [
      // ── Floor 1 ──────────────────────────────────────────────
      { id = "101"; floor = 1; name = "Room 101"; cameraId = "1A"; neighbors = ["corridor_1", "201"]; isExit = true;  isCorridor = false },
      { id = "102"; floor = 1; name = "Room 102"; cameraId = "1B"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "103"; floor = 1; name = "Room 103"; cameraId = "1C"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "104"; floor = 1; name = "Room 104"; cameraId = "1D"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "105"; floor = 1; name = "Room 105"; cameraId = "1E"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "106"; floor = 1; name = "Room 106"; cameraId = "1F"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "107"; floor = 1; name = "Room 107"; cameraId = "1G"; neighbors = ["corridor_1"];         isExit = false; isCorridor = false },
      { id = "108"; floor = 1; name = "Room 108"; cameraId = "1H"; neighbors = ["corridor_1", "208"]; isExit = true;  isCorridor = false },
      { id = "corridor_1"; floor = 1; name = "Corridor 1"; cameraId = "";
        neighbors = ["101","102","103","104","105","106","107","108"]; isExit = false; isCorridor = true },

      // ── Floor 2 ──────────────────────────────────────────────
      { id = "201"; floor = 2; name = "Room 201"; cameraId = "2A"; neighbors = ["corridor_2", "101", "301"]; isExit = false; isCorridor = false },
      { id = "202"; floor = 2; name = "Room 202"; cameraId = "2B"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "203"; floor = 2; name = "Room 203"; cameraId = "2C"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "204"; floor = 2; name = "Room 204"; cameraId = "2D"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "205"; floor = 2; name = "Room 205"; cameraId = "2E"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "206"; floor = 2; name = "Room 206"; cameraId = "2F"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "207"; floor = 2; name = "Room 207"; cameraId = "2G"; neighbors = ["corridor_2"];              isExit = false; isCorridor = false },
      { id = "208"; floor = 2; name = "Room 208"; cameraId = "2H"; neighbors = ["corridor_2", "108", "308"]; isExit = false; isCorridor = false },
      { id = "corridor_2"; floor = 2; name = "Corridor 2"; cameraId = "";
        neighbors = ["201","202","203","204","205","206","207","208"]; isExit = false; isCorridor = true },

      // ── Floor 3 ──────────────────────────────────────────────
      { id = "301"; floor = 3; name = "Room 301"; cameraId = "3A"; neighbors = ["corridor_3", "201"]; isExit = false; isCorridor = false },
      { id = "302"; floor = 3; name = "Room 302"; cameraId = "3B"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "303"; floor = 3; name = "Room 303"; cameraId = "3C"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "304"; floor = 3; name = "Room 304"; cameraId = "3D"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "305"; floor = 3; name = "Room 305"; cameraId = "3E"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "306"; floor = 3; name = "Room 306"; cameraId = "3F"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "307"; floor = 3; name = "Room 307"; cameraId = "3G"; neighbors = ["corridor_3"];        isExit = false; isCorridor = false },
      { id = "308"; floor = 3; name = "Room 308"; cameraId = "3H"; neighbors = ["corridor_3", "208"]; isExit = false; isCorridor = false },
      { id = "corridor_3"; floor = 3; name = "Corridor 3"; cameraId = "";
        neighbors = ["301","302","303","304","305","306","307","308"]; isExit = false; isCorridor = true },
    ]
  };

  // ── A* Pathfinding ───────────────────────────────────────────

  // Extract floor number from a room id for heuristic
  func floorOf(id : Text) : Int {
    if (id == "corridor_1") { 1 }
    else if (id == "corridor_2") { 2 }
    else if (id == "corridor_3") { 3 }
    else {
      if (id.size() >= 1) {
        let firstChar = id.toArray()[0];
        switch (firstChar) {
          case '1' { 1 };
          case '2' { 2 };
          case '3' { 3 };
          case _   { 0 };
        }
      } else { 0 }
    }
  };

  // Heuristic: floor distance to nearest exit (exits on floor 1)
  func heuristic(id : Text) : Int {
    let dist : Nat = Int.abs(floorOf(id) - 1);
    dist.toInt() * 2
  };

  // Reconstruct path by following cameFrom map from goal back to start
  func reconstructPath(cameFrom : Map.Map<Text, Text>, goal : Text) : [Text] {
    let result = List.empty<Text>();
    var current = goal;
    label tracing while (true) {
      result.add(current);
      switch (cameFrom.get(current)) {
        case (?prev) { current := prev };
        case null    { break tracing };
      };
    };
    result.reverseInPlace();
    result.toArray()
  };

  // Pure A* over the floor-plan graph.
  public func computeEscapePath(
    floorPlan    : [Types.RoomData],
    startRoom    : Text,
    blockedRooms : [Text],
  ) : { #ok : [Text]; #err : Text } {
    // Build adjacency map
    let adjMap = Map.empty<Text, [Text]>();
    for (room in floorPlan.values()) {
      adjMap.add(room.id, room.neighbors);
    };

    // Build room-lookup map (id → RoomData)
    let roomMap = Map.empty<Text, Types.RoomData>();
    for (room in floorPlan.values()) {
      roomMap.add(room.id, room);
    };

    // Blocked set
    let blocked = Set.fromArray(blockedRooms);

    // Validate start
    switch (roomMap.get(startRoom)) {
      case null { return #err ("Start room not found: " # startRoom) };
      case (?_) {};
    };

    // If start is an exit, return trivial path
    switch (roomMap.get(startRoom)) {
      case (?r) {
        if (r.isExit) { return #ok ([startRoom]) };
      };
      case null {};
    };

    // g and f score maps
    let gScore   = Map.empty<Text, Int>();
    let cameFrom = Map.empty<Text, Text>();
    let closedSet = Set.empty<Text>();

    // Open set as a list of (fScore, id)
    let openList = List.empty<(Int, Text)>();

    gScore.add(startRoom, 0);
    openList.add((heuristic(startRoom), startRoom));

    label astar while (true) {
      if (openList.isEmpty()) { break astar };

      // Find entry with minimum fScore
      var minF : Int = 999999;
      var currentId : Text = "";
      for ((f, nodeId) in openList.values()) {
        if (f < minF) {
          minF := f;
          currentId := nodeId;
        };
      };

      if (currentId == "") { break astar };

      // Check if goal (exit node)
      switch (roomMap.get(currentId)) {
        case (?r) {
          if (r.isExit) {
            return #ok (reconstructPath(cameFrom, currentId));
          };
        };
        case null {};
      };

      // Move from open to closed (remove current from openList)
      let remaining = openList.filter(func((_, nid) : (Int, Text)) : Bool { nid != currentId });
      openList.clear();
      openList.append(remaining);
      closedSet.add(currentId);

      // Expand neighbours
      let neighbours : [Text] = switch (adjMap.get(currentId)) {
        case (?ns) ns;
        case null  [];
      };

      let currentG : Int = switch (gScore.get(currentId)) {
        case (?g) g;
        case null 999999;
      };

      for (neighbourId in neighbours.values()) {
        if (not blocked.contains(neighbourId) and not closedSet.contains(neighbourId)) {
          let tentativeG = currentG + 1;
          let prevG : Int = switch (gScore.get(neighbourId)) {
            case (?g) g;
            case null 999999;
          };

          if (tentativeG < prevG) {
            cameFrom.add(neighbourId, currentId);
            gScore.add(neighbourId, tentativeG);
            let newF = tentativeG + heuristic(neighbourId);

            let alreadyOpen = openList.any(func((_, nid) : (Int, Text)) : Bool { nid == neighbourId });
            if (not alreadyOpen) {
              openList.add((newF, neighbourId));
            };
          };
        };
      };
    };

    #err ("No escape path found from " # startRoom)
  };
};
