import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Button } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const GameScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gameDetails } = route.params;
  const { userId, username } = useAuth();
  const socket = useSocket();

  const [scores, setScores] = useState(() => {
    const initialScores = {};
    if (gameDetails && gameDetails.players) {
      gameDetails.players.forEach(p => { initialScores[p.userId] = 0; });
    }
    return initialScores;
  });

  const [question, setQuestion] = useState(null);
  const [timer, setTimer] = useState(10);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const opponent = gameDetails?.players?.find(p => Number(p.userId) !== Number(userId));

  useEffect(() => {
    if (!socket.current) return;
    socket.current.emit('player_ready', { gameId: gameDetails.gameId, userId });

    const onNewQuestion = (data) => {
      setQuestion(data);
      setTimer(10);
      setHasAnswered(false);
      setFeedback('');
    };

    // --- THIS IS THE CORRECTED SCORE UPDATE LOGIC ---
    const onScoreUpdate = (data) => {
      const updatedScores = {};
      if (data && data.players) {
        for (const playerId in data.players) {
          updatedScores[playerId] = data.players[playerId].score;
        }
        setScores(updatedScores);
      }
    };
    
    const onTimesUp = ({correctAnswer}) => {
      setHasAnswered(true);
      setFeedback(`Time's up! The correct answer was ${correctAnswer}.`);
    };

    const onGameOver = (data) => {
      let title = 'Game Over!';
      let message = `Final Scores:\nYou: ${data.scores[userId]}\n${opponent?.username}: ${data.scores[opponent?.userId]}`;

      if (data.reason === 'forfeit' || data.reason === 'disconnect') {
          if (data.winnerId === Number(userId)) {
              title = 'You Won!';
              message = `Your opponent has forfeited the match.\n\n${message}`;
          } else {
              title = 'Match Forfeited';
          }
      }

      Alert.alert(
          title,
          message,
          [{ text: 'Back to Lobby', onPress: () => navigation.navigate('Main', { screen: 'CompeteTab' }) }]
      );
    };

    socket.current.on('new_question', onNewQuestion);
    socket.current.on('score_update', onScoreUpdate);
    socket.current.on('times_up', onTimesUp);
    socket.current.on('game_over', onGameOver);
    
    const interval = setInterval(() => setTimer(prev => (prev > 0 ? prev - 1 : 0)), 1000);

    return () => {
      clearInterval(interval);
      socket.current.off('new_question', onNewQuestion);
      socket.current.off('score_update', onScoreUpdate);
      socket.current.off('times_up', onTimesUp);
      socket.current.off('game_over', onGameOver);
    };
  }, [socket.current, gameDetails.gameId]);
  
  const handleAnswer = (answer) => {
    if (hasAnswered || !socket.current) return;
    setHasAnswered(true);
    socket.current.emit('submit_answer', { gameId: gameDetails.gameId, userId, answer });
  };

  const handleForfeit = () => {
    Alert.alert("Forfeit Match", "Are you sure you want to leave? This will count as a loss.",
      [{ text: "Cancel", style: "cancel" },
      { text: "Yes, Forfeit", onPress: () => {
          if (socket.current) {
              socket.current.emit('forfeit_match', { gameId: gameDetails.gameId, userId });
          }
      }, style: "destructive" }]
    );
  };
  
  if (!question) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007BFF"/>
        <Text style={styles.feedbackText}>Waiting for game to start...</Text>
      </View>
    );
  }

  const options = ['A', 'B', 'C', 'D'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.playerScore}>
          <Text style={styles.username}>{username} (You)</Text>
          <Text style={styles.score}>{scores[userId] || 0}</Text>
        </View>
        <View style={styles.timerContainer}>
            <Text style={styles.timer}>{timer}</Text>
        </View>
        <View style={styles.playerScore}>
          <Text style={styles.username}>{opponent?.username}</Text>
          <Text style={styles.score}>{scores[opponent?.userId] || 0}</Text>
        </View>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionNumber}>Question {question.questionNumber}/{question.totalQuestions}</Text>
        <Text style={styles.questionText}>{question.question.question_text}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.optionButton, hasAnswered && styles.disabledOption]}
            onPress={() => handleAnswer(option)}
            disabled={hasAnswered}
          >
            <Text style={styles.optionText}>{option}: {question.question[`option_${option.toLowerCase()}`]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
      <View style={{marginTop: 40}}>
        <Button title="Forfeit Match" color="red" onPress={handleForfeit} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, padding: 10, backgroundColor: '#f0f4f7' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    playerScore: { alignItems: 'center', flex: 1 },
    username: { fontSize: 16, fontWeight: 'bold' },
    score: { fontSize: 24, color: '#007BFF' },
    timerContainer: { flex: 0.5, alignItems: 'center', justifyContent: 'center' },
    timer: { fontSize: 28, fontWeight: 'bold', color: 'red' },
    questionContainer: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 20 },
    questionNumber: { fontSize: 14, color: 'gray', marginBottom: 10 },
    questionText: { fontSize: 18, fontWeight: '500' },
    optionsContainer: {},
    optionButton: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10 },
    disabledOption: { backgroundColor: '#e0e0e0' },
    optionText: { fontSize: 16 },
    feedbackText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20 },
});

export default GameScreen;