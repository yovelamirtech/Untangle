import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { getDifficultyForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import PuzzleNodeHandle from './PuzzleNodeHandle';
import { countCrossings, generateSolvedGraph, Graph, Node, scrambleGraph } from './puzzle';

const NODE_RADIUS = 14;
const HANDLE_SIZE = 40;
const ADVANCE_DELAY_MS = 1000;

function buildPuzzle(boardSize: number, level: number): Graph {
  const { nodeCount, edgeCount } = getDifficultyForLevel(level);
  const solved = generateSolvedGraph(
    nodeCount,
    edgeCount,
    { x: boardSize / 2, y: boardSize / 2 },
    boardSize / 2 - 30
  );
  return scrambleGraph(solved, boardSize, boardSize, 30);
}

export default function PuzzleScreen() {
  const { width, height } = useWindowDimensions();
  const boardSize = Math.max(Math.min(width, height) - 40, 200);

  const [level, setLevel] = useState(1);
  const [graph, setGraph] = useState<Graph>(() => buildPuzzle(boardSize, 1));
  const [crossings, setCrossings] = useState(() => countCrossings(graph));

  const positions = useSharedValue<Node[]>(graph.nodes);
  const pulse = useSharedValue(0);
  const crossingsRef = useRef(crossings);
  const graphRef = useRef(graph);

  const advanceLevel = useCallback(() => {
    if (crossingsRef.current !== 0) return;
    const nextLevel = level + 1;
    const nextGraph = buildPuzzle(boardSize, nextLevel);
    setLevel(nextLevel);
    setGraph(nextGraph);
    graphRef.current = nextGraph;
    positions.value = nextGraph.nodes;
    const nextCrossings = countCrossings(nextGraph);
    setCrossings(nextCrossings);
    crossingsRef.current = nextCrossings;
    pulse.value = 0;
  }, [boardSize, level, positions, pulse]);

  const handleDrag = useCallback(() => {
    const newCrossings = countCrossings({ nodes: positions.value, edges: graphRef.current.edges });
    const wasSolved = crossingsRef.current === 0;
    crossingsRef.current = newCrossings;
    setCrossings(newCrossings);

    if (newCrossings === 0 && !wasSolved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.3, { duration: 250 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 250 })
      );
      setTimeout(advanceLevel, ADVANCE_DELAY_MS);
    }
  }, [advanceLevel, positions, pulse]);

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
              pulse={pulse}
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
              pulse={pulse}
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
