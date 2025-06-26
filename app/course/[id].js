import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Modal, Animated, Vibration } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from "expo-linear-gradient";
import ProtectedRoute from "../../components/ProtectedRoute";
import SolutionVisualization from "../../components/SolutionVisualization";
import storage from "../utils/storage";
import { Colors } from "../../constants/Colors";
import { exercisePageStyles } from "../../styles/styles";
import api from "../../src/api/axiosConfig";
import { FontAwesome5 } from "@expo/vector-icons";

/* ───────────── עזרי שברים ───────────── */
const formatFraction = (n, d) => (n === 0 ? "0" : n === d ? "1" : `${n}/${d}`);

const Fraction = ({ numerator, denominator }) => (
    <View style={{ alignItems: "center", marginHorizontal: 4 }}>
        <Text style={{ fontSize: 20 }}>{numerator}</Text>
        <View style={{ height: 1, backgroundColor: "black", width: 30, marginVertical: 2 }} />
        <Text style={{ fontSize: 20 }}>{denominator}</Text>
    </View>
);

const FractionInQuestionTitle = ({ numerator, denominator }) => (
    <View style={{ alignItems: "center", marginHorizontal: 4 }}>
        <Text style={exercisePageStyles.title}>{numerator}</Text>
        <View style={{ height: 1, backgroundColor: "white", width: 30, marginVertical: 2 }} />
        <Text style={exercisePageStyles.title}>{denominator}</Text>
    </View>
);

/* ───────────── הקומפוננטה הראשית ───────────── */
export default function StyledCoursePage() {
    const { id } = useLocalSearchParams();   // id == topicId או 'random'
    const router  = useRouter();

    /* --- state ---- */
    const [question, setQuestion]             = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult]         = useState(false);
    const [responseMessage, setResponseMessage] = useState("");
    const [showLevelUpModal, setShowLevelUpModal]   = useState(false);
    const [showLevelDownModal, setShowLevelDownModal] = useState(false);
    const [showConfetti, setShowConfetti]     = useState(false);
    const [showSuccessIcon, setShowSuccessIcon] = useState(false);
    const [levelChangeText, setLevelChangeText] = useState("");
    const [myTopicLevel, setMyTopicLevel]     = useState(1);
    const [showSolution, setShowSolution]     = useState(false);
    const [history, setHistory]               = useState([]);
    const [isCheckDisabled, setIsCheckDisabled] = useState(false);
    const [detailedSolutions, setDetailedSolutions] = useState(true);
    const [answerFeedbackColor, setAnswerFeedbackColor] = useState(null);


    const fadeAnim    = useRef(new Animated.Value(0)).current;
    const successAnim = useRef(new Animated.Value(0)).current;


    useEffect(() => {
        if (!id) return;
        if (id === "random") fetchRandomQuestion();
        else {
            fetchTopicLevel(id);
            fetchNextQuestion(id);
        }
    }, [id]);

    useEffect(() => {
        if (showSolution)
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
        else fadeAnim.setValue(0);
    }, [showSolution]);

    /* האם להציג פתרונות מפורטים – נמשך מה-user */
    useEffect(() => {
        api.get("/api/user").then(r =>
            setDetailedSolutions(
                r.data.hasOwnProperty("detailedSolutions") ? r.data.detailedSolutions : true
            )
        );
    }, []);

    /*שליפת הרמה של המשתמש בנושא */
    async function fetchTopicLevel(topicId) {
        try {
            const res   = await api.get("/api/user/topics-levels");
            const found = (res.data.topics || []).find(t => t.topicId == topicId);
            if (found) setMyTopicLevel(found.level);
        } catch (err) {
            console.log("Error fetchTopicLevel:", err);
        }
    }

    /*שליפת השאלה הבאה  */

    async function fetchNextQuestion(topicId) {
        try {
            const res = await api.get(`/api/exercises/next?topicId=${topicId}`);
            prepQuestion(res.data);
        } catch (err) {
            failLoadingQuestion(err);
        }
    }

    async function fetchRandomQuestion() {
        try {
            const res = await api.get("/api/exercises/next-random");
            prepQuestion(res.data);
        } catch (err) {
            failLoadingQuestion(err);
        }
    }

    /* עוטפת את set-state של שאלה חדשה */
    function prepQuestion(questionData) {
        setIsCheckDisabled(false);
        questionData.text = generateQuestionText(
            questionData.first,
            questionData.second,
            questionData.operationSign,
            myTopicLevel
        );
        setQuestion(questionData);
        setSelectedAnswer(null);
        setShowResult(false);
        setResponseMessage("");
        setShowLevelUpModal(false);
        setShowLevelDownModal(false);
        setShowConfetti(false);
        setShowSolution(false);
        setAnswerFeedbackColor(null);
    }

    function failLoadingQuestion(err) {
        if (err.response?.status === 401) {
            storage.remove("userToken").then(() => router.replace("/authentication/Login"));
        } else {
            console.error("❌ fetch question error:", err);
            alert("שגיאה בשרת בעת טעינת שאלה");
        }
    }

    /*בדיקת תשובה*/
    async function handleCheckAnswer() {
        if (selectedAnswer === null) { alert("יש לבחור תשובה תחילה."); return; }
        if (isCheckDisabled) return;
        setIsCheckDisabled(true);

        try {
            const userAnswerValue = question.answers[selectedAnswer];
            const res = await api.post("/api/exercises/answer", {
                answer:   userAnswerValue,
                question
            });

            setShowResult(true);

            const { isCorrect, correctAnswer, currentLevel, levelChangeMessage } = res.data;
            const isFraction = typeof question.first === "string" && question.first.includes("/");

            const correctDisplay = isFraction
                ? `${Math.floor(correctAnswer / 1000)}/${correctAnswer % 1000}`
                : correctAnswer;

            if (isCorrect) {
                setAnswerFeedbackColor("green");
                if (levelChangeMessage) {
                    setResponseMessage(`תשובה נכונה! ${levelChangeMessage}`);
                    setLevelChangeText(levelChangeMessage);
                    setShowLevelUpModal(true);
                    setShowConfetti(true);
                } else {
                    setResponseMessage(`תשובה נכונה! רמה נוכחית: ${currentLevel}`);
                    triggerSuccessAnimation();
                }
            } else {
                setAnswerFeedbackColor("red");
                Vibration.vibrate(200);
                if (levelChangeMessage) {
                    setResponseMessage(levelChangeMessage);
                    setLevelChangeText(levelChangeMessage);
                    if (levelChangeMessage.includes("ירדת") || levelChangeMessage.includes("עדיין ברמה"))
                        setShowLevelDownModal(true);
                } else {
                    setResponseMessage(`תשובה שגויה! התשובה הנכונה היא ${correctDisplay}`);
                }
            }

            setHistory(prev => [
                ...prev,
                {
                    question: `${question.first} ${convertSign(question.operationSign)} ${question.second}`,
                    userAnswer: decodeFraction(userAnswerValue),
                    correct: isCorrect
                }
            ]);
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error;
            setResponseMessage(msg ?? "שגיאה לא ידועה, נסי שוב.");
        }
    }

    /*סימני חישוב*/
    const convertSign = sign => ({ "+": "+", "-": "-", "×": "×", "÷": "÷" }[sign] ?? sign);

    const decodeFraction = encoded => {
        if (encoded < 1000) return encoded.toString();
        const num = Math.floor(encoded / 1000);
        const den = encoded % 1000;
        if (den === 0) return "∞";
        return num % den === 0 ? `${num / den}` : `${num}/${den}`;
    };

    function generateQuestionText(first, second, sign) {
        const op = convertSign(sign);
        const generic = [
            `כמה זה ${second} ${op} ${first}?`,
            `${second} ${op} ${first} שווה ל...?`
        ];
        return generic[Math.floor(Math.random() * generic.length)];
    }

    function triggerSuccessAnimation() {
        setShowSuccessIcon(true);
        Animated.sequence([
            Animated.timing(successAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(successAnim, { toValue: 0, duration: 500, useNativeDriver: true })
        ]).start(() => setShowSuccessIcon(false));
    }

    /* פתרונות ויזואליים  */
    function renderVisualExplanation() {
        // כפל
        if (id == 3) {
            let first  = Number(question.first);
            let second = Number(question.second);
            if (second < first) [first, second] = [second, first];

            const rows = Array.from({ length: second }, (_, r) => (
                <View key={r} style={{ flexDirection: "row" }}>
                    {Array.from({ length: first }, (_, c) => (
                        <View key={c} style={exercisePageStyles.ball} />
                    ))}
                </View>
            ));

            return (
                <Animated.View style={[exercisePageStyles.explanation, { opacity: fadeAnim }]}>
                    <Text style={exercisePageStyles.explanationText}>
                        {second} קבוצות של {first} כדורים:
                    </Text>
                    <View style={{ alignItems: "center", marginVertical: 8 }}>{rows}</View>

                    <Text style={exercisePageStyles.explanationText}>
                        בכל טור יש {second} כדורים, ויש {first} טורים. ביחד זה {first * second} כדורים.
                    </Text>
                </Animated.View>
            );
        }

        // חילוק
        if (id == 4) {
            const dividend = Number(question.first);
            const divisor  = Number(question.second);
            const quotient = dividend / divisor;
            if (dividend <= 20 && divisor > 0 && Number.isInteger(quotient))
                return (
                    <Animated.View style={[exercisePageStyles.explanation, { opacity: fadeAnim }]}>
                        <Text style={exercisePageStyles.explanationText}>
                            {dividend} כדורים מחולקים ל-{divisor} ילדים
                        </Text>
                        <SolutionVisualization firstNum={dividend} secondNum={divisor} operation="div" />
                        <Text style={exercisePageStyles.explanationText}>
                            כל אחד מקבל {quotient}
                        </Text>
                    </Animated.View>
                );
        }

        // חיבור / חיסור
        const opWord = id == 1 ? "נוסיף" : "נחסיר";
        return (
            <Animated.View style={[exercisePageStyles.explanation, { opacity: fadeAnim }]}>
                <Text style={exercisePageStyles.explanationText}>
                    נניח שיש {question.first} כדורים, {opWord} {question.second}
                </Text>
                <SolutionVisualization
                    firstNum={Number(question.first)}
                    secondNum={Number(question.second)}
                    operation={id == 1 ? "add" : "sub"}
                />
            </Animated.View>
        );
    }

    function renderVerticalSolution() {
        const sign   = convertSign(question.operationSign);
        const first  = Number(question.first);
        const second = Number(question.second);
        const result = eval(`${first}${sign}${second}`);
        return (
            <Animated.View style={[exercisePageStyles.explanation, { opacity: fadeAnim }]}>
                <Text style={exercisePageStyles.explanationText}>פתרון במאונך:</Text>
                <Text style={[exercisePageStyles.explanationText, { fontFamily: "monospace" }]}>{`
   ${first}
${sign}  ${second}
---------
   ${result}`}</Text>
            </Animated.View>
        );
    }

    if (!id || !question) return <Text style={exercisePageStyles.loading}>טוען...</Text>;

    const isFraction     = typeof question.first === "string" && question.first.includes("/");
    const displayAnswers = isFraction
        ? question.answers.map(encoded => `${Math.floor(encoded / 1000)}/${encoded % 1000}`)
        : question.answers;

    /* תנאי להצגת כפתור הסבר חזותי */
    const firstNum       = Number(question.first);
    const secondNum      = Number(question.second);
    const multiplyResult = firstNum * secondNum;
    const isAddOrSubOrSmallMulOrDiv =
        id == 1 || id == 2 ||
        (id == 3 && multiplyResult < 20) ||
        (id == 4 && firstNum <= 20 && secondNum > 0 && Number.isInteger(firstNum / secondNum));

    const isVisual = myTopicLevel <= 2;

    return (
        <ProtectedRoute requireAuth>
            <ScrollView contentContainerStyle={exercisePageStyles.container}
                        style={{ backgroundColor: Colors.background }}>

                <LinearGradient
                    colors={[Colors.primary, Colors.accent]}
                    start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }}
                    style={exercisePageStyles.gradientQuestionBox}>

                    <View style={{ alignItems: "center", marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            {isFraction && (question.first.includes("/") || question.second.includes("/")) ? (
                                <>
                                    {question.first.includes("/") ? (
                                        <FractionInQuestionTitle
                                            numerator={question.first.split("/")[0]}
                                            denominator={question.first.split("/")[1]}
                                        />
                                    ) : (
                                        <Text style={exercisePageStyles.title}>{question.first}</Text>
                                    )}
                                    <Text style={exercisePageStyles.title}>{convertSign(question.operationSign)}</Text>
                                    {question.second.includes("/") ? (
                                        <FractionInQuestionTitle
                                            numerator={question.second.split("/")[0]}
                                            denominator={question.second.split("/")[1]}
                                        />
                                    ) : (
                                        <Text style={exercisePageStyles.title}>{question.second}</Text>
                                    )}
                                    <Text style={exercisePageStyles.title}>= ?</Text>
                                </>
                            ) : (
                                <Text style={exercisePageStyles.title}>{question.text}</Text>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* --- תשובות --- */}
                {displayAnswers.map((ans, idx) => {
                    const isAnsFraction = typeof ans === "string" && ans.includes("/");
                    const [num, den]    = isAnsFraction ? ans.split("/") : [];

                    const isSelected     = selectedAnswer === idx;
                    const isCorrectAnswer = question.answers[idx] === question.correctAnswer;

                    let answerStyle = exercisePageStyles.answerButton;
                    if (showResult) {
                        if (isSelected)
                            answerStyle = isCorrectAnswer
                                ? exercisePageStyles.correctAnswer
                                : exercisePageStyles.incorrectAnswer;
                        else if (isCorrectAnswer) answerStyle = exercisePageStyles.correctAnswer;
                    } else if (isSelected) {
                        answerStyle = exercisePageStyles.selectedAnswer;
                    }

                    return (
                        <Pressable
                            key={idx}
                            style={answerStyle}
                            onPress={() => !showResult && setSelectedAnswer(idx)}
                            disabled={showResult}>
                            <View style={{ alignItems: "center" }}>
                                {isAnsFraction
                                    ? ["1", "0"].includes(formatFraction(+num, +den))
                                        ? <Text style={exercisePageStyles.answerText}>{formatFraction(+num, +den)}</Text>
                                        : <Fraction numerator={num} denominator={den} />
                                    : <Text style={exercisePageStyles.answerText}>{ans}</Text>}
                            </View>
                        </Pressable>
                    );
                })}

                {/* כפתור בדיקה */}
                <Pressable
                    onPress={handleCheckAnswer}
                    style={[exercisePageStyles.checkButton, isCheckDisabled && { opacity: 0.5 }]}
                    disabled={isCheckDisabled}>
                    <Text style={exercisePageStyles.primaryText}>בדיקה</Text>
                </Pressable>

                {/* פידבק */}
                {responseMessage !== "" && (
                    <Text style={[exercisePageStyles.feedback, { color: answerFeedbackColor }]}>
                        {responseMessage}
                    </Text>
                )}

                {/* כפתור שאלה הבאה */}
                <Pressable
                    onPress={() => (id === "random" ? fetchRandomQuestion() : fetchNextQuestion(id))}
                    style={[exercisePageStyles.nextButton, !showResult && { opacity: 0.5 }]}>
                    <Text style={exercisePageStyles.nextButtonText}>שאלה הבאה</Text>
                </Pressable>

                {/* כפתור “איך פותרים” */}
                {detailedSolutions && isAddOrSubOrSmallMulOrDiv && (
                    <Pressable onPress={() => showResult && setShowSolution(!showSolution)}
                               style={exercisePageStyles.helpButton}>
                        <Text style={{
                            color: showResult ? "#A47DAB" : "gray",
                            fontWeight: showResult ? "bold" : "normal",
                            fontSize: 18,
                            textDecorationLine: showResult ? "underline" : "none"
                        }}>
                            {showSolution ? "הסתר פתרון" : "איך פותרים?"}
                        </Text>
                    </Pressable>
                )}

                {/* הצגת הפתרון עצמו */}
                {showSolution && showResult && (
                    isVisual ? renderVisualExplanation() : renderVerticalSolution()
                )}

                {showConfetti && <ConfettiCannon count={100} origin={{ x: 200, y: 0 }} fadeOut />}
                {showSuccessIcon && (
                    <Animated.View style={[
                        exercisePageStyles.successIconBase,
                        {
                            transform: [
                                { translateX: -50 },
                                { scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) }
                            ],
                            opacity: successAnim
                        }
                    ]}>
                        <FontAwesome5 name="grin-stars" size={200} color="#4CAF50" />
                    </Animated.View>
                )}

                {/* מודאלים רמת-קפיצה / ירידה */}
                <Modal visible={showLevelUpModal} transparent animationType="slide">
                    <View style={exercisePageStyles.modalOverlay}>
                        <View style={exercisePageStyles.modalBox}>
                            <Text style={exercisePageStyles.modalTitle}>כל הכבוד!</Text>
                            <Text style={exercisePageStyles.modalText}>{levelChangeText}</Text>
                            <Pressable onPress={() => setShowLevelUpModal(false)} style={exercisePageStyles.closeButton}>
                                <Text style={exercisePageStyles.closeButtonText}>סגור</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                <Modal visible={showLevelDownModal} transparent animationType="slide">
                    <View style={exercisePageStyles.modalOverlay}>
                        <View style={exercisePageStyles.modalBox}>
                            <Text style={exercisePageStyles.modalTitle}>לא נורא!</Text>
                            <Text style={exercisePageStyles.modalText}>{levelChangeText}</Text>
                            <Pressable onPress={() => setShowLevelDownModal(false)} style={exercisePageStyles.closeButton}>
                                <Text style={exercisePageStyles.closeButtonText}>סגור</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {/* היסטוריה */}
                <View style={{ marginTop: 30, alignItems: "center" }}>
                    <Text style={exercisePageStyles.sectionTitle}>היסטוריית תשובות:</Text>
                    {history.map((item, i) => (
                        <Text key={i} style={{
                            color: item.correct ? "green" : "red",
                            textAlign: "center",
                            writingDirection: "rtl"
                        }}>
                            {"\u200E" + item.question} | ענית: {item.userAnswer} {item.correct ? "✓" : "✗"}
                        </Text>
                    ))}
                </View>

                {/* חזרה לדשבורד / קורסים */}
                <Pressable
                    onPress={() => router.push(id === "random" ? "/Dashboard" : "/MyCourses")}
                    style={[exercisePageStyles.finishButton, { marginTop: 40 }]}>
                    <Text style={exercisePageStyles.primaryText}>סיום תרגול</Text>
                </Pressable>
            </ScrollView>
        </ProtectedRoute>
    );
}
