import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { countCrossings, generateSolvedGraph, Graph, scrambleGraph } from './puzzle';

const NODE_COUNT = 6;
const EDGE_COUNT = 7;

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
  const crossings = useMemo(() => countCrossings(graph), [graph]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Untangle</Text>
      <Text style={styles.subtitle}>{crossings} crossing{crossings === 1 ? '' : 's'}</Text>
      <Svg width={boardSize} height={boardSize} style={styles.board}>
        {graph.edges.map((edge, i) => {
          const from = graph.nodes.find((n) => n.id === edge.a)!;
          const to = graph.nodes.find((n) => n.id === edge.b)!;
          return (
            <Line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#8888ff"
              strokeWidth={2}
            />
          );
        })}
        {graph.nodes.map((node) => (
          <Circle key={node.id} cx={node.x} cy={node.y} r={10} fill="#ffffff" />
        ))}
      </Svg>
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
  board: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
});
