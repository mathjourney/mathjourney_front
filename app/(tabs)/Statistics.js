import React, { useEffect, useState } from 'react';
import { Text, View, Pressable, StyleSheet, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import ProtectedRoute from '../../components/ProtectedRoute';

const Colors = {
    primary: '#8b5cf6',
    accent: '#fb923c',
    background: '#f8f6ff',
    light: '#ede9fe',
    secondary: '#7c3aed',
    success: '#10B981',
    danger: '#EF4444',
};

export default function Statistics() {
    const router = useRouter();
    const [overallStats, setOverallStats] = useState(null);
    const [topicStats, setTopicStats] = useState([]);
    const [loading, setLoading] = useState(true);

    function handleGoBack() {
        router.push('/Dashboard');
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [overallRes, topicRes] = await Promise.all([
                    axios.get('http://localhost:8080/api/statistics'),
                    axios.get('http://localhost:8080/api/statistics/by-topic')
                ]);
                setOverallStats(overallRes.data);
                setTopicStats(topicRes.data);
            } catch (error) {
                console.error('Error fetching statistics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>טוען סטטיסטיקות...</Text>
            </View>
        );
    }

    if (!overallStats) {
        return (
            <ProtectedRoute requireAuth={true}>
                <View style={styles.container}>
                    <Text style={styles.title}>📊 סטטיסטיקה כללית</Text>
                    <Text style={styles.infoText}>לא קיימים עדיין נתונים להצגה.</Text>
                    <Pressable onPress={handleGoBack} style={styles.backButton}>
                        <Text style={styles.backButtonText}>🔙 חזרה למסך הראשי</Text>
                    </Pressable>
                </View>
            </ProtectedRoute>
        );
    }

    const topicNames = {
        1: "חיבור",
        2: "חיסור",
        3: "כפל",
        4: "חילוק",
        5: "חיבור שברים",
        6: "חיסור שברים",
        7: "כפל שברים",
        8: "חילוק שברים"
    };

    const renderTopicItem = ({ item }) => (
        <View style={styles.topicCard}>
            <Text style={styles.topicTitle}>🧩 {topicNames[item.topicId]}</Text>
            <Text style={styles.topicStat}>ניסיונות: {item.totalAttempts}</Text>
            <Text style={styles.topicStat}>טעויות: {item.totalMistakes}</Text>
            <Text style={styles.topicStat}>
                אחוז הצלחה: {item.successRate != null ? item.successRate.toFixed(1) + "%" : "אין נתונים"}
            </Text>
        </View>
    );

    return (
        <ProtectedRoute requireAuth={true}>
            <View style={styles.container}>
                <Text style={styles.title}>📊 סטטיסטיקה כללית (כלל המשתמשים)</Text>
                <Text style={styles.infoText}>סה"כ ניסיונות: {overallStats.totalAttempts}</Text>
                <Text style={styles.infoText}>סה"כ טעויות: {overallStats.totalMistakes}</Text>
                <Text style={styles.infoText}>
                    אחוז הצלחה ממוצע: {overallStats.successRate != null ? overallStats.successRate.toFixed(2) + "%" : "אין נתונים"}
                </Text>
                <Text style={styles.infoText}>
                    הנושא הקשה ביותר: {overallStats.mostDifficultTopic != null ? `נושא #${overallStats.mostDifficultTopic}` : "אין נתונים"}
                </Text>
                <Text style={styles.infoText}>
                    הנושא הקל ביותר: {overallStats.easiestTopic != null ? `נושא #${overallStats.easiestTopic}` : "אין נתונים"}
                </Text>

                <Text style={[styles.title, { marginTop: 30 }]}>📚 סטטיסטיקה לפי נושא</Text>

                {topicStats.length === 0 ? (
                    <Text style={styles.infoText}>אין נתונים לפי נושאים.</Text>
                ) : (
                    <FlatList
                        data={topicStats}
                        keyExtractor={(item) => item.topicId.toString()}
                        renderItem={renderTopicItem}
                        contentContainerStyle={{ paddingBottom: 30 }}
                        style={{ width: '100%' }}
                    />
                )}

                <Pressable onPress={handleGoBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>🔙 חזרה למסך הראשי</Text>
                </Pressable>
            </View>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        backgroundColor: Colors.background,
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
        textAlign: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#444',
        marginVertical: 4,
        textAlign: 'center',
    },
    backButton: {
        marginTop: 24,
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        alignItems: 'center',
    },
    backButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    topicCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
        marginVertical: 8,
        width: '100%',
    },
    topicTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
        marginBottom: 6,
        textAlign: 'center',
    },
    topicStat: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#555',
        textAlign: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: Colors.secondary,
        textAlign: 'center',
    },
});
