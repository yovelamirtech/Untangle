import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import PuzzleNodeHandle from './PuzzleNodeHandle';
import { countCrossings, generateSolvedGraph, Graph, Node, scrambleGraph } from './puzzle';

const NODE_COUNT = 6;
const EDGE_COUNT = 7;
const NODE_RADIUS = 14;
const HANDLE_SIZE = 40;

function buildPuzzle(boardSize: number): Graph {
  const solved = generateSolvedGraph(
    NODE_COUNT,
    EDGE_COUNT,
    { x: boardSize / 2, y: boardSize / 2 },
    boardSize / 2 - 30
  );
  return scrambleGraph(solved, boardSize, boardSize, 30);
}

export default function PuzzleScreen() {
  const { width, height } = useWindowDimensions();
  const boardSize = Math.max(Math.min(width, height) - 40, 200);
  const [graph] = useState<Graph>(() => buildPuzzle(boardSize));
  const positions = useSharedValue<Node[]>(graph.nodes);
  const [crossings, setCrossings] = useState(() => countCrossings(graph));

  const handleDrag = useCallback(() => {
    setCrossings(countCrossings({ nodes: positions.value, edges: graph.edges }));
  }, [graph.edges, positions]);

  const solved = crossings === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Untangle</Text>
      <Text style={[styles.subtitle, solved && styles.subtitleSolved]}>
        {solved ? 'Solved!' : `${crossings} crossing${crossings === 1 ? '' : 's'}`}
      </Text>
      <View style={[styles.boardWrapper, { width: boardSize, height: boardSize }]}>
        <Svg width={boardSize} height={boardSize} style={styles.board}>
          {graph.edges.map((edge, i) => (
            <PuzzleEdge
              key={i}
              fromId={edge.a}
              toId={edge.b}
              positions={positions}
              color={solved ? '#4ade80' : '#8888ff'}
            />
          ))}
          {graph.nodes.map((node) => (
            <PuzzleNode
              key={node.id}
              id={node.id}
              radius={NODE_RADIUS}
              fill={solved ? '#4ade80' : '#ffffff'}
              positions={positions}
            />
          ))}
        </Svg>
        {graph.nodes.map((node) => (
          <PuzzleNodeHandle
            key={node.id}
            id={node.id}
            size={HANDLE_SIZE}
            positions={positions}
            onDrag={handleDrag}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111122',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaaacc',
    fontSize: 14,
    marginBottom: 16,
  },
  subtitleSolved: {
    color: '#4ade80',
    fontWeight: '600',
  },
  boardWrapper: {
    position: 'relative',
  },
  board: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
});
