import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from "../assets/ai.gif";
import userImg from "../assets/user.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx"; // Corrected import based on your original
import './Home.css';
function Home() {
  const {
    userData,
    serverUrl,
    setUserData,
    getGeminiResponse,
    loading
  } = useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [assistantStarted, setAssistantStarted] = useState(false);
  const [ham, setHam] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const synth = window.speechSynthesis;
  const voicesPromiseRef = useRef(null); // To manage voice loading asynchronously

  // --- Effect for redirecting if not signed in ---
  useEffect(() => {
    if (!loading && !userData) {
      navigate("/signin");
    }
  }, [loading, userData, navigate]);

  // --- Effect to load voices for speech synthesis (more robust) ---
  useEffect(() => {
    if (!synth) {
      console.warn("SpeechSynthesis API not available.");
      return;
    }

    // Function to get voices, returns a Promise that resolves when voices are ready
    const getSynthVoices = () => {
      return new Promise(resolve => {
        const checkVoices = () => {
          const voices = synth.getVoices();
          if (voices.length > 0) {
            resolve(voices);
          } else {
            // If voices aren't immediately available, listen for them
            synth.onvoiceschanged = () => {
              resolve(synth.getVoices());
              synth.onvoiceschanged = null; // Remove listener after voices are found
            };
          }
        };
        checkVoices();
      });
    };

    // Store the promise so we don't try to load voices multiple times
    if (!voicesPromiseRef.current) {
      voicesPromiseRef.current = getSynthVoices();
    }

    return () => {
      if (synth && synth.onvoiceschanged) {
        synth.onvoiceschanged = null; // Cleanup listener
      }
    };
  }, [synth]); // Dependency on synth ensures this runs when synth is available


  // --- Logout Handler ---
  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.error("Logout failed:", error);
    }
  };

  // --- Start Speech Recognition ---
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) {
        console.warn("Recognition object not initialized.");
        return;
    }
    if (!isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current.start();
        console.log("Speech recognition attempted to start.");
      } catch (error) {
        // Handle InvalidStateError which means recognition is already active or in a bad state
        if (error.name !== "InvalidStateError") {
          console.error("Start recognition error:", error);
        } else {
          console.log("Recognition already active or stopping (InvalidStateError).");
        }
      }
    } else {
        console.log("Recognition not started: conditions not met.", {isSpeaking: isSpeakingRef.current, isRecognizing: isRecognizingRef.current});
    }
  }, []); // No dependencies needed as refs are stable

  // --- Speak using TTS ---
  const speak = useCallback(async (text) => { // Made speak async
    if (!text || !synth) {
      console.warn("Speak called with no text or synth not available.");
      // If no text or synth not available, just ensure flags are reset and recognition tries to restart
      setAiText(""); // Make sure text is clear
      isSpeakingRef.current = false;
      setTimeout(() => startRecognition(), 500);
      return;
    }

    setAiText(text); // Immediately display AI text when speaking starts

    try {
      const voices = await voicesPromiseRef.current; // Await loaded voices
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = userData?.assistantLanguage || 'en-US';

      const preferredVoice = voices.find(v => v.lang === utterance.lang);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      } else {
        const englishVoice = voices.find(v => v.lang.startsWith('en-'));
        if (englishVoice) utterance.voice = englishVoice;
        else console.warn("No suitable voice found for speaking.");
      }

      isSpeakingRef.current = true; // Mark as speaking

      utterance.onend = () => {
        isSpeakingRef.current = false; // Finished speaking
        console.log("Speech finished. Clearing AI text and attempting to restart recognition.");
        // Clear AI text AFTER speech finishes and `isSpeakingRef` is set to false
        setAiText("");
        setTimeout(() => startRecognition(), 800); // Give a small buffer
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        isSpeakingRef.current = false; // Mark as not speaking due to error
        console.log("Speech error. Clearing AI text and attempting to restart recognition.");
        // Clear AI text AFTER speech error and `isSpeakingRef` is set to false
        setAiText("");
        setTimeout(() => startRecognition(), 800); // On error, still try to restart recognition
      };

      synth.cancel(); // Cancel any ongoing speech
      synth.speak(utterance);
      console.log("AI is speaking:", text);
    } catch (error) {
      console.error("Error preparing speech:", error);
      isSpeakingRef.current = false; // Mark as not speaking due to preparation error
      setAiText(""); // Clear text if there's an error during preparation
      setTimeout(() => startRecognition(), 800); // Attempt to restart even if speech fails
    }
  }, [userData, startRecognition, synth]); // Dependencies: userData, startRecognition (from useCallback), synth

  // --- Handle AI response commands ---
  const handleCommand = useCallback(async (data) => { // Made handleCommand async to await getGeminiResponse
    const { type, userInput, response } = data;
    speak(response); // Use the memoized speak function

    const query = encodeURIComponent(userInput);
    const links = {
      'google-search': `https://www.google.com/search?q=${query}`,
      'calculator-open': `https://www.google.com/search?q=calculator`,
      'instagram-open': `https://www.instagram.com/`,
      'facebook-open': `https://www.facebook.com/`,
      'weather-show': `https://www.google.com/search?q=weather`,
      // For YouTube, it's better to use youtube.com/results?search_query= rather than googleusercontent.com
      'Youtube': `https://www.youtube.com/results?search_query=${query}`,
      'youtube-play': `https://www.youtube.com/results?search_query=${query}`,
    };

    // Slight delay before opening external link to allow speech to initiate
    if (links[type]) {
      setTimeout(() => {
        window.open(links[type], '_blank');
      }, 500); // Small delay
    }
  }, [speak]); // speak is a dependency

  // --- Initial greeting and start assistant ---
  const handleStartAssistant = useCallback(() => {
    if (assistantStarted) return;
    setAssistantStarted(true);

    const greetingText = `Hello ${userData.name}, what can I help you with?`;
    console.log("Attempting to start assistant. Greeting text:", greetingText);
    speak(greetingText); // Use the general speak function for greeting as well
  }, [assistantStarted, userData, speak]);

  // --- Setup speech recognition ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser. Please use Chrome or Edge for full functionality.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = userData?.assistantLanguage || 'en-US'; // Use user's language for recognition
    recognition.interimResults = false;
    recognitionRef.current = recognition; // Assign the recognition object to the ref

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
      console.log("Speech recognition started.");
      setMicPermissionDenied(false);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      console.log("Speech recognition ended.");
      // Auto-restart recognition if assistant is active and not currently speaking
      // And if the mic permission hasn't been denied
      if (!isSpeakingRef.current && assistantStarted && !micPermissionDenied) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error("Recognition restart error on end:", e);
          }
        }, 1000); // 1-sec'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''NIKHILond delay before restarting
      }GARGITHAS
    };C

    recognition.onerror = (event) => {
      isRecognizingRef.current = false;
      setListening(false);
      console.error("Speech recognition error:", event.error);

      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setMicPermissionDenied(true);
        console.warn("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (event.error === "no-speech" || event.error !== "aborted") {
        // If no speech is detected or it's not an intentional abort, try to restart
        if (!isSpeakingRef.current && assistantStarted && !micPermissionDenied) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error("Recognition restart error on error:", e);
            }
          }, 1200); // Slightly longer delay for errors
        }
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      console.log("User said:", transcript);
      setUserText(transcript); // Display user's text immediately

      if (userData?.assistantName && transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        recognition.stop(); // Stop recognition as assistant's name was detected
        isRecognizingRef.current = false;
        setListening(false);

        const assistantNameLower = userData.assistantName.toLowerCase();
        let queryWithoutName = transcript.toLowerCase().replace(assistantNameLower, '').trim();

        if (!queryWithoutName) {
          const responseForJustName = `Yes, how can I help you, ${userData.name}?`;
          speak(responseForJustName);
        } else {
          // Send full transcript to Gemini, let it parse context
          const data = await getGeminiResponse(transcript);
          handleCommand(data);
        }
      } else {
        // If assistant's name not detected, clear user text after a short while
        // Only clear if the AI is not currently speaking
        setTimeout(() => {
          if (!isSpeakingRef.current) {
            setUserText("");
          }
        }, 3000);
      }
    };

    // Cleanup function for useEffect
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setListening(false);
      isRecognizingRef.current = false;
      synth.cancel(); // Cancel any ongoing speech synthesis
      console.log("Speech recognition cleaned up.");
    };
  }, [userData, getGeminiResponse, synth, assistantStarted, micPermissionDenied, speak, handleCommand]); // Dependencies for useEffect

  if (loading) {
    return <div className="text-white text-center mt-20">Loading...</div>;
  }
return (
  <div className='w-full h-screen bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-4 overflow-hidden relative'>

    {/* Hamburger */}
    <CgMenuRight className='lg:hidden text-white absolute top-5 right-5 w-6 h-6 cursor-pointer z-50' onClick={() => setHam(true)} />

    {/* Start Assistant Button */}
    {!assistantStarted && (
      <button
        onClick={handleStartAssistant}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 min-w-[160px] h-[60px] bg-white text-black font-semibold text-lg px-6 py-3 rounded-full shadow-md hover:scale-105 transition-all duration-200 z-30"
      >
        Start Assistant
      </button>
    )}

    {/* Mobile Menu */}
    <div className={`fixed inset-0 lg:hidden bg-black/60 backdrop-blur-md p-5 flex flex-col gap-5 items-start z-40 transition-transform duration-300 ${ham ? "translate-x-0" : "translate-x-full"}`}>
      <RxCross1 className='text-white absolute top-5 right-5 w-6 h-6 cursor-pointer' onClick={() => setHam(false)} />
      <button className='w-full bg-white text-black font-semibold text-lg py-3 rounded-full hover:bg-gray-200 transition' onClick={handleLogOut}>Log Out</button>
      <button className='w-full bg-white text-black font-semibold text-lg py-3 rounded-full hover:bg-gray-200 transition' onClick={() => navigate("/customize")}>Customize your Assistant</button>
      <div className='w-full h-px bg-gray-400' />
      <h1 className='text-white font-semibold text-lg'>History</h1>
      <div className='w-full max-h-[400px] overflow-y-auto flex flex-col gap-2 pr-2'>
        {userData.history?.map((his, index) => (
          <div key={index} className='text-gray-300 text-base truncate'>{his}</div>
        ))}
      </div>
    </div>

    {/* Desktop Controls */}
    <div className='hidden lg:flex flex-col gap-4 absolute top-5 right-5 z-40'>
      <button className='bg-white text-black font-semibold text-lg py-2 px-6 rounded-full hover:bg-gray-200 transition' onClick={handleLogOut}>Log Out</button>
      <button className='bg-white text-black font-semibold text-lg py-2 px-6 rounded-full hover:bg-gray-200 transition' onClick={() => navigate("/customize")}>Customize your Assistant</button>
    </div>

    {/* Assistant Image */}
    <div className={`w-[280px] h-[380px] mt-[40px] flex justify-center items-center overflow-hidden rounded-3xl shadow-xl transition-all duration-300 ${aiText ? 'speaking-animation' : ''}`}>
      <img src={userData?.assistantImage || aiImg} alt="assistant" className='h-full object-cover' />
    </div>

    {/* Assistant Name */}
    <h1 className='text-white text-lg font-semibold mt-4 animate-fadein'>I'm {userData?.assistantName}</h1>

    {/* Mic Wave */}
    {assistantStarted && !aiText && (
      <div className="mic-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    )}

    {/* GIFs shown only after assistant starts */}
    {assistantStarted && !aiText && <img src={userImg} alt="user" className='w-[180px] mt-2' />}
    {assistantStarted && aiText && <img src={aiImg} alt="ai" className='w-[180px] mt-2' />}

    {/* Plain White Texts */}
    {assistantStarted && (
      <div className="mt-4 flex flex-col items-center gap-2">
        {userText && (
          <div className="text-white font-medium text-center text-lg">
            {userText}
          </div>
        )}
        {aiText && (
          <div className="text-white font-medium text-center text-lg">
            {aiText}
          </div>
        )}
      </div>
    )}
  </div>
);


}

export default Home;