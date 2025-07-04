/**
 * Utils/PathFinding.ts
 *
 * Path Finding Algorithm (A*)
 *
 * Trying to find the shortest path between two positions.
 * This file is based on eAthena/rAthena code, optimized for JS.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Position interface for 2D coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * GAT (Ground Altitude) cell types
 */
export enum CellType {
  WALKABLE = 1,
  NONE = 0,
  SNIPABLE = 2
}

/**
 * GAT world information interface
 */
export interface GATInfo {
  width: number;
  height: number;
  cells: Uint8Array;
  types: typeof CellType;
}

/**
 * Path search result interface
 */
export interface PathResult {
  success: boolean;
  inRange: boolean;
  targetCell: Position;
  pathLength: number;
  path?: Position[];
}

/**
 * Pathfinding configuration
 */
export interface PathFindingConfig {
  maxHeapSize?: number;
  maxWalkPath?: number;
  diagonalCost?: number;
  straightCost?: number;
}

/**
 * Search statistics
 */
export interface SearchStats {
  nodesExplored: number;
  searchTime: number;
  pathLength: number;
  success: boolean;
}

/**
 * Modern PathFinding implementation with A* algorithm
 */
export class PathFinding {
  private static _instance: PathFinding;
  
  // Configuration constants
  private readonly MAX_HEAP: number;
  private readonly MAX_WALKPATH: number;
  private readonly DIAGONAL_COST: number;
  private readonly STRAIGHT_COST: number;

  // World data
  private _gat: GATInfo = {
    width: 0,
    height: 0,
    cells: new Uint8Array(0),
    types: CellType
  };

  // Memory pools to avoid garbage collection
  private _heap: Uint32Array;
  private _heapClean: Uint32Array;
  private _shortClean: Uint16Array;
  private _charClean: Uint8Array;
  private _dc: Uint8Array;

  // Temporary path arrays
  private _x: Uint16Array;
  private _y: Uint16Array;
  private _dist: Uint16Array;
  private _cost: Uint16Array;
  private _before: Uint16Array;
  private _flag: Uint8Array;

  /**
   * Create PathFinding instance
   */
  private constructor(config: PathFindingConfig = {}) {
    this.MAX_HEAP = config.maxHeapSize || 150;
    this.MAX_WALKPATH = config.maxWalkPath || 33;
    this.DIAGONAL_COST = config.diagonalCost || 14;
    this.STRAIGHT_COST = config.straightCost || 10;

    // Initialize memory pools
    this._heap = new Uint32Array(this.MAX_HEAP);
    this._heapClean = new Uint32Array(this.MAX_HEAP);
    this._shortClean = new Uint16Array(this.MAX_WALKPATH * this.MAX_WALKPATH);
    this._charClean = new Uint8Array(this.MAX_WALKPATH * this.MAX_WALKPATH);
    this._dc = new Uint8Array(4);

    // Initialize path arrays
    const pathSize = this.MAX_WALKPATH * this.MAX_WALKPATH;
    this._x = new Uint16Array(pathSize);
    this._y = new Uint16Array(pathSize);
    this._dist = new Uint16Array(pathSize);
    this._cost = new Uint16Array(pathSize);
    this._before = new Uint16Array(pathSize);
    this._flag = new Uint8Array(pathSize);
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: PathFindingConfig): PathFinding {
    if (!PathFinding._instance) {
      PathFinding._instance = new PathFinding(config);
    }
    return PathFinding._instance;
  }

  /**
   * Set GAT (Ground Altitude) information
   */
  setGAT(gat: GATInfo): void {
    this._gat = { ...gat };
  }

  /**
   * Update cell type at specific position
   */
  updateCell(x: number, y: number, type: CellType): void {
    if (x >= 0 && x < this._gat.width && y >= 0 && y < this._gat.height) {
      this._gat.cells[x + y * this._gat.width] = type;
    }
  }

  /**
   * Get cell type at specific position
   */
  getCell(x: number, y: number): CellType {
    if (x < 0 || x >= this._gat.width || y < 0 || y >= this._gat.height) {
      return CellType.NONE;
    }
    return this._gat.cells[x + y * this._gat.width];
  }

  /**
   * Check direct path between two points
   */
  searchLong(from: Position, to: Position, range: number = 0): PathResult {
    const result: PathResult = {
      success: false,
      inRange: false,
      targetCell: { x: from.x, y: from.y },
      pathLength: 0
    };

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

    let x = from.x;
    let y = from.y;
    const path: Position[] = [{ x, y }];

    // Check if already in range
    if (Math.sqrt(dx * dx + dy * dy) <= range) {
      result.success = true;
      result.inRange = true;
      result.pathLength = 1;
      result.path = path;
      return result;
    }

    let i = 1;
    while (i <= this.MAX_WALKPATH) {
      x += stepX;
      y += stepY;

      // Check if reached destination
      if (result.success && x === to.x && y === to.y) {
        break;
      }

      // Check if cell is walkable
      const cellType = this.getCell(x, y);
      if (cellType === CellType.NONE) {
        result.success = false;
        break;
      }

      if (!result.success && cellType === CellType.SNIPABLE) {
        result.success = false;
        break;
      }

      if (!result.success) {
        path.push({ x, y });
        result.pathLength = i;
      }

      // Check if in range
      const remainingDx = to.x - x;
      const remainingDy = to.y - y;
      if (Math.sqrt(remainingDx * remainingDx + remainingDy * remainingDy) <= range && !result.success) {
        result.success = true;
        result.inRange = false;
        result.targetCell = { x, y };
      }

      // Stop if reached destination
      if (x === to.x) stepX === 0;
      if (y === to.y) stepY === 0;
      if (stepX === 0 && stepY === 0) break;

      i++;
    }

    result.path = path;
    return result;
  }

  /**
   * Find path using A* algorithm
   */
  search(from: Position, to: Position, range: number = 0): Position[] {
    const startTime = performance.now();
    
    // Try direct path first
    const directResult = this.searchLong(from, to, range);
    if (directResult.success) {
      return directResult.path || [from];
    }

    // A* pathfinding
    this._cleanMemory();
    
    const path: Position[] = [from];
    const heap = this._heap;
    
    const startIndex = this._calcIndex(from.x, from.y);
    this._x[startIndex] = from.x;
    this._y[startIndex] = from.y;
    this._cost[startIndex] = this._calcCost(startIndex, to.x, to.y);
    
    heap[0] = 0;
    this._pushHeap(heap, startIndex);

    const sizeX = this._gat.width - 1;
    const sizeY = this._gat.height - 1;
    let nodesExplored = 0;

    while (true) {
      const currentNode = this._popHeap(heap);
      
      if (currentNode < 0) {
        // No path found
        return [];
      }

      nodesExplored++;
      const x = this._x[currentNode];
      const y = this._y[currentNode];
      const dist = this._dist[currentNode] + this.STRAIGHT_COST;

      // Check if reached destination
      if (x === to.x && y === to.y) {
        return this._reconstructPath(currentNode, from);
      }

      // Explore neighbors
      this._dc.fill(0);
      let dirFlag = 0;
      let error = 0;

      // Cardinal directions
      if (y < sizeY && this._isWalkable(x, y + 1)) {
        this._dc[0] = y >= to.y ? 20 : 0;
        dirFlag |= 1;
        error += this._addPath(heap, x, y + 1, dist, currentNode, this._cost[currentNode] + this._dc[0]);
      }

      if (x > 0 && this._isWalkable(x - 1, y)) {
        this._dc[1] = x <= to.x ? 20 : 0;
        dirFlag |= 2;
        error += this._addPath(heap, x - 1, y, dist, currentNode, this._cost[currentNode] + this._dc[1]);
      }

      if (y > 0 && this._isWalkable(x, y - 1)) {
        this._dc[2] = y <= to.y ? 20 : 0;
        dirFlag |= 4;
        error += this._addPath(heap, x, y - 1, dist, currentNode, this._cost[currentNode] + this._dc[2]);
      }

      if (x < sizeX && this._isWalkable(x + 1, y)) {
        this._dc[3] = x >= to.x ? 20 : 0;
        dirFlag |= 8;
        error += this._addPath(heap, x + 1, y, dist, currentNode, this._cost[currentNode] + this._dc[3]);
      }

      // Diagonal directions
      if ((dirFlag & 3) === 3 && this._isWalkable(x - 1, y + 1)) {
        error += this._addPath(heap, x - 1, y + 1, dist + 4, currentNode, this._cost[currentNode] + this._dc[1] + this._dc[0] - 6);
      }

      if ((dirFlag & 6) === 6 && this._isWalkable(x - 1, y - 1)) {
        error += this._addPath(heap, x - 1, y - 1, dist + 4, currentNode, this._cost[currentNode] + this._dc[1] + this._dc[2] - 6);
      }

      if ((dirFlag & 12) === 12 && this._isWalkable(x + 1, y - 1)) {
        error += this._addPath(heap, x + 1, y - 1, dist + 4, currentNode, this._cost[currentNode] + this._dc[3] + this._dc[2] - 6);
      }

      if ((dirFlag & 9) === 9 && this._isWalkable(x + 1, y + 1)) {
        error += this._addPath(heap, x + 1, y + 1, dist + 4, currentNode, this._cost[currentNode] + this._dc[3] + this._dc[0] - 6);
      }

      this._flag[currentNode] = 1;

      // Check for errors or heap overflow
      if (error || heap[0] >= this.MAX_HEAP - 5) {
        return [];
      }
    }
  }

  /**
   * Calculate array index for position
   */
  private _calcIndex(x: number, y: number): number {
    return (x + y * this.MAX_WALKPATH) % (this.MAX_WALKPATH * this.MAX_WALKPATH);
  }

  /**
   * Calculate heuristic cost (Manhattan distance + current distance)
   */
  private _calcCost(index: number, targetX: number, targetY: number): number {
    return (Math.abs(targetX - this._x[index]) + Math.abs(targetY - this._y[index])) * 10 + this._dist[index];
  }

  /**
   * Check if cell is walkable
   */
  private _isWalkable(x: number, y: number): boolean {
    return (this._gat.cells[x + y * this._gat.width] & CellType.WALKABLE) !== 0;
  }

  /**
   * Clean memory arrays
   */
  private _cleanMemory(): void {
    this._heap.set(this._heapClean);
    this._x.set(this._shortClean);
    this._y.set(this._shortClean);
    this._dist.set(this._shortClean);
    this._cost.set(this._shortClean);
    this._before.set(this._shortClean);
    this._flag.set(this._charClean);
  }

  /**
   * Push node to heap
   */
  private _pushHeap(heap: Uint32Array, index: number): void {
    let h = heap[0]++;
    
    for (let i = (h - 1) >> 1; h > 0 && this._cost[index] < this._cost[heap[i + 1]]; i = (h - 1) >> 1) {
      heap[h + 1] = heap[i + 1];
      h = i;
    }
    
    heap[h + 1] = index;
  }

  /**
   * Pop node from heap
   */
  private _popHeap(heap: Uint32Array): number {
    if (heap[0] <= 0) return -1;

    const ret = heap[1];
    const last = heap[heap[0]--];
    const cost = this._cost[last];

    let h = 0;
    let k = 2;
    
    while (k < heap[0]) {
      if (this._cost[heap[k + 1]] > this._cost[heap[k]]) {
        k--;
      }
      heap[h + 1] = heap[k + 1];
      h = k;
      k = k * 2 + 2;
    }

    if (k === heap[0]) {
      heap[h + 1] = heap[k];
      h = k - 1;
    }

    for (let i = (h - 1) >> 1; h > 0 && this._cost[heap[i + 1]] > cost; i = (h - 1) >> 1) {
      heap[h + 1] = heap[i + 1];
      h = i;
    }

    heap[h + 1] = last;
    return ret;
  }

  /**
   * Add path node
   */
  private _addPath(heap: Uint32Array, x: number, y: number, dist: number, before: number, cost: number): number {
    const i = this._calcIndex(x, y);

    if (this._x[i] === x && this._y[i] === y) {
      if (this._dist[i] > dist) {
        this._dist[i] = dist;
        this._before[i] = before;
        this._cost[i] = cost;

        if (this._flag[i]) {
          this._pushHeap(heap, i);
        } else {
          this._updateHeap(heap, i);
        }

        this._flag[i] = 0;
      }
      return 0;
    }

    if (this._x[i] || this._y[i]) {
      return 1;
    }

    this._x[i] = x;
    this._y[i] = y;
    this._dist[i] = dist;
    this._before[i] = before;
    this._cost[i] = cost;
    this._flag[i] = 0;

    this._pushHeap(heap, i);
    return 0;
  }

  /**
   * Update heap position
   */
  private _updateHeap(heap: Uint32Array, index: number): void {
    let h = 0;
    
    // Find the index in heap
    while (h < heap[0] && heap[h + 1] !== index) {
      h++;
    }

    if (h === heap[0]) {
      throw new Error('PathFinding::updateHeap() - Error updating heap path');
    }

    const cost = this._cost[index];
    
    for (let i = (h - 1) >> 1; h > 0 && cost < this._cost[heap[i + 1]]; i = (h - 1) >> 1) {
      heap[h + 1] = heap[i + 1];
      h = i;
    }

    heap[h + 1] = index;
  }

  /**
   * Reconstruct path from goal to start
   */
  private _reconstructPath(goalIndex: number, start: Position): Position[] {
    const path: Position[] = [];
    const startIndex = this._calcIndex(start.x, start.y);
    
    // Calculate path length
    let pathLen = 0;
    for (let i = goalIndex; pathLen < 100 && i !== startIndex; i = this._before[i], pathLen++) {
      // Count nodes
    }

    // Build path array
    for (let i = goalIndex, j = pathLen - 1; j >= 0; i = this._before[i], j--) {
      path[j] = { x: this._x[i], y: this._y[i] };
    }

    return [start, ...path];
  }
}

/**
 * Global pathfinding instance
 */
export const pathFinder = PathFinding.getInstance();

/**
 * Set GAT information
 */
export function setGAT(gat: GATInfo): void {
  pathFinder.setGAT(gat);
}

/**
 * Update cell type
 */
export function updateGAT(x: number, y: number, type: CellType): void {
  pathFinder.updateCell(x, y, type);
}

/**
 * Search for path between two points
 */
export function search(from: Position, to: Position, range: number = 0): Position[] {
  return pathFinder.search(from, to, range);
}

/**
 * Check direct line of sight
 */
export function searchLong(from: Position, to: Position, range: number = 0): PathResult {
  return pathFinder.searchLong(from, to, range);
}

/**
 * Legacy export for backward compatibility
 */
export default {
  setGat: setGAT,
  updateGat: updateGAT,
  search,
  searchLong
};