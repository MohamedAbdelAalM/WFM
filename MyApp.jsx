import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { LogIn, User, Users, Calendar, ArrowRightLeft, Check, X, RotateCw, PlusCircle, UserCog, Upload, Download, Key, UserPlus, Mail, Briefcase } from 'lucide-react';
import * as XLSX from 'xlsx';

// Initialize Firebase with global variables provided by the environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState(null);
  const [team, setTeam] = useState(null); // New state for team name
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [usersCredentials, setUsersCredentials] = useState({
    'agent1': { password: '123', name: 'Agent Smith' },
    'TL1': { password: '123', name: 'Team Lead Jones' },
    'Admin': { password: '123', name: 'Admin Lee' },
  });

  // Authenticate with Firebase on component mount
  useEffect(() => {
    const authenticate = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase authentication failed", error);
      } finally {
        setIsLoading(false);
      }
    };
    authenticate();
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUserId(authUser.uid);
        // Set up initial user data if the collection is empty
        await setupInitialUserData(authUser.uid);
      } else {
        setUserId(null);
      }
      setIsAuthReady(true);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Set up initial user data in Firestore
  const setupInitialUserData = async (currentUserId) => {
    const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
      console.log("Setting up initial user data.");
      const initialUsers = [
        { id: 'admin_id', name: 'Admin Lee', fullName: 'Admin Lee', email: 'admin@example.com', role: 'admin' },
        { id: 'agent1_id', name: 'Agent Smith', fullName: 'John Smith', email: 'john.smith@example.com', role: 'agent', team: 'Team A', tl: 'Team Lead Jones', status: 'Attuned' },
        { id: 'TL1_id', name: 'Team Lead Jones', fullName: 'Jane Jones', email: 'jane.jones@example.com', role: 'tl', team: 'Team A' },
        { id: 'agent2_id', name: 'Agent Miller', fullName: 'Peter Miller', email: 'peter.miller@example.com', role: 'agent', team: 'Team B', tl: 'TL for Team B', status: 'Attuned' }
      ];

      for (const userData of initialUsers) {
        try {
          await setDoc(doc(usersRef, userData.id), userData);
        } catch (error) {
          console.error("Error setting initial user data:", error);
        }
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const userDetails = usersCredentials[username];
    if (userDetails && userDetails.password === password) {
      const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
      const q = query(usersRef, where('name', '==', userDetails.name));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setUser({ ...userData, id: querySnapshot.docs[0].id });
        setRole(userData.role);
        setTeam(userData.team); // Set the team name on login
      } else {
        setLoginError('User not found in database.');
      }
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setRole(null);
    setTeam(null);
    setUsername('');
    setPassword('');
  };

  const handlePasswordChange = (newPassword) => {
    const updatedCredentials = {
      ...usersCredentials,
      [username]: { ...usersCredentials[username], password: newPassword },
    };
    setUsersCredentials(updatedCredentials);
    handleLogout();
  };

  if (isLoading || !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="flex items-center space-x-2">
          <RotateCw className="animate-spin text-blue-500" size={24} />
          <p className="text-lg text-gray-700">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Calendar className="mr-3 text-blue-500" size={32} />
            Agent Schedule & Swap
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-600 hidden sm:block">
                Logged in as: <span className="font-bold text-blue-600">{user.name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-md text-sm"
              >
                <LogIn className="mr-2" size={16} />
                Logout
              </button>
            </div>
          )}
        </div>

        {user ? (
          role === 'admin' ? (
            <AdminDashboard db={db} appId={appId} userId={userId} onPasswordChange={handlePasswordChange} username={username} />
          ) : role === 'tl' ? (
            <TeamLeadDashboard db={db} appId={appId} userId={userId} onPasswordChange={handlePasswordChange} username={username} userTeam={team} />
          ) : (
            <AgentDashboard user={user} db={db} appId={appId} userId={userId} onPasswordChange={handlePasswordChange} username={username} />
          )
        ) : (
          <Login
            username={username}
            password={password}
            setUsername={setUsername}
            setPassword={setPassword}
            handleLogin={handleLogin}
            loginError={loginError}
          />
        )}
      </div>
      {/* Display userId for collaboration */}
      {userId && (
        <div className="mt-4 p-4 text-center text-sm text-gray-500 bg-white rounded-lg shadow-inner">
          <p>Your unique application ID is: <span className="font-mono text-gray-700 font-bold">{appId}</span></p>
          <p>Your user ID is: <span className="font-mono text-gray-700 font-bold">{userId}</span></p>
        </div>
      )}
    </div>
  );
}

// Login Component
function Login({ username, password, setUsername, setPassword, handleLogin, loginError }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-full max-w-sm bg-gray-50 p-8 rounded-xl shadow-lg border border-gray-200">
        <h2 className="2xl font-bold text-gray-800 text-center mb-6 flex items-center justify-center">
          <User className="mr-2 text-gray-500" />
          Login
        </h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
          <button
            type="submit"
            className="w-full flex justify-center items-center py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors duration-200 shadow-md"
          >
            <LogIn className="mr-2" size={20} />
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

// Agent Dashboard Component
function AgentDashboard({ user, db, appId, userId, onPasswordChange, username }) {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [requestRecipient, setRequestRecipient] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [message, setMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Fetch all schedules, users, and swap requests in real-time
  useEffect(() => {
    if (!db || !userId) return;

    const schedulesPath = `artifacts/${appId}/public/data/schedules`;
    const requestsPath = `artifacts/${appId}/public/data/swap_requests`;
    const usersPath = `artifacts/${appId}/public/data/users`;

    const schedulesUnsub = onSnapshot(collection(db, schedulesPath), (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(scheduleData);
    }, (error) => {
      console.error("Error fetching schedules:", error);
    });

    const usersQuery = query(collection(db, usersPath), where('role', '==', 'agent'));
    const usersUnsub = onSnapshot(usersQuery, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    const requestsQuery = query(collection(db, requestsPath), where('requesterId', '==', user.name));
    const requestsUnsub = onSnapshot(requestsQuery, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSwapRequests(requestData);
    }, (error) => {
      console.error("Error fetching swap requests:", error);
    });

    return () => {
      schedulesUnsub();
      usersUnsub();
      requestsUnsub();
    };
  }, [db, appId, user, userId]);

  const handleSwapRequest = async (e) => {
    e.preventDefault();
    setRequestLoading(true);
    setRequestError('');
    setMessage('');

    try {
      if (!requestRecipient || !requestDate || !requestTime) {
        setRequestError('Please fill out all fields.');
        setRequestLoading(false);
        return;
      }

      const recipientSchedule = schedules.find(
        (s) => s.agent === requestRecipient && s.date === requestDate && s.shift === requestTime
      );

      if (!recipientSchedule) {
        setRequestError('The recipient does not have a schedule at the requested time. Please check the schedule list.');
        setRequestLoading(false);
        return;
      }

      const requestsRef = collection(db, `artifacts/${appId}/public/data/swap_requests`);
      await addDoc(requestsRef, {
        requesterId: user.name,
        recipientId: requestRecipient,
        date: requestDate,
        newShift: requestTime,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      setMessage('Swap request sent successfully!');
      setRequestRecipient('');
      setRequestDate('');
      setRequestTime('');
    } catch (error) {
      console.error("Error sending swap request:", error);
      setRequestError("Failed to send swap request.");
    } finally {
      setRequestLoading(false);
    }
  };

  const mySchedules = schedules.filter(s => s.agent === user.name);
  const otherAgents = users.filter(u => u.name !== user.name);

  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-md text-sm"
        >
          <Key className="mr-2" size={16} />
          Change Password
        </button>
      </div>
      <div className="bg-orange-50 p-6 rounded-xl shadow-inner border border-orange-200 mb-8">
        <h2 className="text-2xl font-bold text-orange-800 mb-4 flex items-center">
          <User className="mr-2" />
          My Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
                <UserPlus className="text-orange-600 mr-2" />
                <p className="text-gray-700 font-medium">Full Name: <span className="font-normal">{user.fullName}</span></p>
            </div>
            <div className="flex items-center">
                <Mail className="text-orange-600 mr-2" />
                <p className="text-gray-700 font-medium">Email: <span className="font-normal">{user.email}</span></p>
            </div>
            <div className="flex items-center">
                <Briefcase className="text-orange-600 mr-2" />
                <p className="text-gray-700 font-medium">Team: <span className="font-normal">{user.team}</span></p>
            </div>
            <div className="flex items-center">
                <User className="text-orange-600 mr-2" />
                <p className="text-gray-700 font-medium">Team Lead: <span className="font-normal">{user.tl}</span></p>
            </div>
        </div>
      </div>
      <div className="bg-blue-50 p-6 rounded-xl shadow-inner border border-blue-200">
        <h2 className="2xl font-bold text-blue-800 mb-4 flex items-center">
          <Calendar className="mr-2" />
          My Schedules
        </h2>
        {mySchedules.length > 0 ? (
          <ScheduleList schedules={mySchedules} />
        ) : (
          <p className="text-gray-600">You have no schedules at this time.</p>
        )}
      </div>
      <div className="bg-green-50 p-6 rounded-xl shadow-inner border border-green-200">
        <h2 className="2xl font-bold text-green-800 mb-4 flex items-center">
          <ArrowRightLeft className="mr-2" />
          Submit a Swap Request
        </h2>
        <form onSubmit={handleSwapRequest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Swap With</label>
              <select
                value={requestRecipient}
                onChange={(e) => setRequestRecipient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select Agent</option>
                {otherAgents.map(agent => (
                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date to Swap</label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift to Take</label>
              <input
                type="text"
                value={requestTime}
                onChange={(e) => setRequestTime(e.target.value)}
                placeholder="e.g., 09:00 - 17:00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
          </div>
          {requestError && <p className="text-red-500 text-sm mt-2">{requestError}</p>}
          {message && <p className="text-green-500 text-sm mt-2 font-medium">{message}</p>}
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors duration-200 shadow-md flex items-center justify-center"
            disabled={requestLoading}
          >
            {requestLoading ? (
              <>
                <RotateCw className="mr-2 animate-spin" size={20} />
                Submitting...
              </>
            ) : (
              <>
                <ArrowRightLeft className="mr-2" size={20} />
                Send Request
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-yellow-50 p-6 rounded-xl shadow-inner border border-yellow-200">
        <h2 className="2xl font-bold text-yellow-800 mb-4 flex items-center">
          <ArrowRightLeft className="mr-2" />
          My Swap Requests
        </h2>
        {swapRequests.length > 0 ? (
          <SwapRequestList requests={swapRequests} showActions={false} />
        ) : (
          <p className="text-gray-600">You have no active swap requests.</p>
        )}
      </div>

      {showPasswordModal && (
        <PasswordChangeModal
          onClose={() => setShowPasswordModal(false)}
          onPasswordChange={onPasswordChange}
          username={username}
        />
      )}
    </div>
  );
}

// Team Lead Dashboard Component
function TeamLeadDashboard({ db, appId, userId, onPasswordChange, username, userTeam }) {
  const [schedules, setSchedules] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [justifications, setJustifications] = useState([]); // New state for approved justifications
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [message, setMessage] = useState('');
  const [xlsxLoaded, setXlsxLoaded] = useState(false);

  // Dynamically load XLSX library from CDN on component mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      console.log("XLSX library loaded successfully.");
      setXlsxLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load XLSX library.");
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!db || !userId || !userTeam) return;

    const schedulesPath = `artifacts/${appId}/public/data/schedules`;
    const requestsPath = `artifacts/${appId}/public/data/swap_requests`;
    const justificationsPath = `artifacts/${appId}/public/data/justifications`;

    // Filter schedules by the TL's team
    const schedulesQuery = query(collection(db, schedulesPath), where('team', '==', userTeam));
    const schedulesUnsub = onSnapshot(schedulesQuery, (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(scheduleData);
    }, (error) => {
      console.error("Error fetching schedules:", error);
    });

    // Filter swap requests by the TL's team
    const requestsQuery = query(collection(db, requestsPath), where('team', '==', userTeam), where('status', '==', 'pending'));
    const requestsUnsub = onSnapshot(requestsQuery, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSwapRequests(requestData);
    }, (error) => {
      console.error("Error fetching swap requests:", error);
    });
    
    // Fetch approved justifications for the TL's team
    const justificationsQuery = query(collection(db, justificationsPath), where('team', '==', userTeam), where('status', '==', 'approved'));
    const justificationsUnsub = onSnapshot(justificationsQuery, (snapshot) => {
        const justificationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJustifications(justificationData);
    }, (error) => {
        console.error("Error fetching approved justifications:", error);
    });

    return () => {
      schedulesUnsub();
      requestsUnsub();
      justificationsUnsub();
    };
  }, [db, appId, userId, userTeam]);

  const handleApproval = async (request) => {
    try {
      const requestsRef = doc(db, `artifacts/${appId}/public/data/swap_requests`, request.id);
      await updateDoc(requestsRef, { status: 'approved' });

      const recipientScheduleDoc = schedules.find(s => s.agent === request.recipientId && s.date === request.date && s.shift === request.newShift);
      const requesterScheduleDoc = schedules.find(s => s.agent === request.requesterId && s.date === request.date);

      if (requesterScheduleDoc && recipientScheduleDoc) {
          const oldRequesterShift = requesterScheduleDoc.shift;
          const oldRecipientShift = recipientScheduleDoc.shift;

          await updateDoc(doc(db, `artifacts/${appId}/public/data/schedules`, requesterScheduleDoc.id), { shift: oldRecipientShift });
          await updateDoc(doc(db, `artifacts/${appId}/public/data/schedules`, recipientScheduleDoc.id), { shift: oldRequesterShift });
      } else {
        console.error("Error: Could not find schedules to swap.");
      }

    } catch (error) {
      console.error("Error approving swap request:", error);
    }
  };

  const handleDenial = async (requestId) => {
    try {
      const requestsRef = doc(db, `artifacts/${appId}/public/data/swap_requests`, requestId);
      await updateDoc(requestsRef, { status: 'denied' });
    } catch (error) {
      console.error("Error denying swap request:", error);
    }
  };

  const handleMarkAbsent = (schedule) => {
    setSelectedSchedule(schedule);
    setShowJustificationModal(true);
  };

  const handleJustificationSubmit = async (reason, notes) => {
    if (!selectedSchedule) return;

    try {
      const justificationsRef = collection(db, `artifacts/${appId}/public/data/justifications`);
      await addDoc(justificationsRef, {
        scheduleId: selectedSchedule.id,
        agent: selectedSchedule.agent,
        date: selectedSchedule.date,
        reason: reason,
        notes: notes,
        status: 'pending',
        submittedBy: username,
        team: userTeam, // Add the team to the justification
        submittedAt: new Date().toISOString(),
      });
      setMessage(`Absence justification for ${selectedSchedule.agent} on ${selectedSchedule.date} submitted for admin approval.`);
    } catch (error) {
      console.error("Error submitting justification:", error);
      setMessage("Failed to submit justification.");
    } finally {
      setShowJustificationModal(false);
      setSelectedSchedule(null);
    }
  };
  
  const handleExportAbsentCases = () => {
    if (!xlsxLoaded) {
      setMessage("Excel library is not yet loaded.");
      return;
    }
    const absentCasesToExport = justifications.map(({ id, ...rest }) => rest);
    const worksheet = window.XLSX.utils.json_to_sheet(absentCasesToExport);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Absent Cases");
    window.XLSX.writeFile(workbook, "absent_cases.xlsx");
    setMessage("Absent cases exported to absent_cases.xlsx");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-md text-sm"
        >
          <Key className="mr-2" size={16} />
          Change Password
        </button>
      </div>
      <div className="bg-blue-50 p-6 rounded-xl shadow-inner border border-blue-200">
        <h2 className="2xl font-bold text-blue-800 mb-4 flex items-center">
          <Users className="mr-2" />
          {userTeam} Schedules
        </h2>
        {schedules.length > 0 ? (
          <ScheduleList schedules={schedules} onMarkAbsent={handleMarkAbsent} />
        ) : (
          <p className="text-gray-600">No schedules found for this team.</p>
        )}
      </div>

      <div className="bg-red-50 p-6 rounded-xl shadow-inner border border-red-200">
        <h2 className="2xl font-bold text-red-800 mb-4 flex items-center">
          <ArrowRightLeft className="mr-2" />
          Pending Swap Requests for {userTeam}
        </h2>
        {swapRequests.length > 0 ? (
          <SwapRequestList requests={swapRequests} showActions={true} onApprove={handleApproval} onDeny={handleDenial} />
        ) : (
          <p className="text-gray-600">No pending swap requests for this team.</p>
        )}
      </div>

      <div className="bg-indigo-50 p-6 rounded-xl shadow-inner border border-indigo-200">
        <h2 className="2xl font-bold text-indigo-800 mb-4 flex items-center">
          <Download className="mr-2" />
          Data Tools
        </h2>
        <button
          onClick={handleExportAbsentCases}
          className={`w-full flex justify-center items-center py-3 text-white font-bold rounded-lg shadow-md ${xlsxLoaded ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-400 cursor-not-allowed'}`}
          disabled={!xlsxLoaded}
        >
          <Download className="mr-2" size={20} />
          Export Absent Cases to Excel
        </button>
      </div>
      {showPasswordModal && (
        <PasswordChangeModal
          onClose={() => setShowPasswordModal(false)}
          onPasswordChange={onPasswordChange}
          username={username}
        />
      )}
      {showJustificationModal && (
        <AbsenceJustificationModal
          onClose={() => setShowJustificationModal(false)}
          onSubmit={handleJustificationSubmit}
          agentName={selectedSchedule?.agent}
        />
      )}
      {message && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-800 text-white rounded-lg shadow-xl text-center z-50">
          {message}
        </div>
      )}
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard({ db, appId, userId, onPasswordChange, username }) {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [justifications, setJustifications] = useState([]); // New state for justifications
  const [filteredAgent, setFilteredAgent] = useState('all');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentFullName, setNewAgentFullName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('agent'); // New state for role
  const [newAgentTeam, setNewAgentTeam] = useState('');
  const [newAgentTL, setNewAgentTL] = useState('');
  const [newScheduleAgent, setNewScheduleAgent] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleShift, setNewScheduleShift] = useState('');
  const [message, setMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // State to track if XLSX is loaded
  const [xlsxLoaded, setXlsxLoaded] = useState(false);

  // Dynamically load XLSX library from CDN on component mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      console.log("XLSX library loaded successfully.");
      setXlsxLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load XLSX library.");
      setMessage("Error: Failed to load Excel library. Import/Export will not work.");
    };
    document.body.appendChild(script);
  }, []);

  // Fetch all schedules, users, and justifications in real-time
  useEffect(() => {
    if (!db || !userId) return;

    const schedulesPath = `artifacts/${appId}/public/data/schedules`;
    const usersPath = `artifacts/${appId}/public/data/users`;
    const justificationsPath = `artifacts/${appId}/public/data/justifications`;

    const schedulesUnsub = onSnapshot(collection(db, schedulesPath), (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(scheduleData);
    }, (error) => {
      console.error("Error fetching schedules:", error);
    });

    const usersUnsub = onSnapshot(collection(db, usersPath), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    const justificationsUnsub = onSnapshot(query(collection(db, justificationsPath), where('status', '==', 'pending')), (snapshot) => {
        const justificationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJustifications(justificationData);
    }, (error) => {
        console.error("Error fetching justifications:", error);
    });


    return () => {
      schedulesUnsub();
      usersUnsub();
      justificationsUnsub();
    };
  }, [db, appId, userId]);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    try {
      const schedulesRef = collection(db, `artifacts/${appId}/public/data/schedules`);
      const agentUser = users.find(u => u.name === newScheduleAgent);
      if (!agentUser) {
        setMessage('Error: Selected agent not found.');
        return;
      }

      await addDoc(schedulesRef, {
        agent: newScheduleAgent,
        date: newScheduleDate,
        shift: newScheduleShift,
        day: new Date(newScheduleDate).toLocaleString('en-US', { weekday: 'long' }),
        team: agentUser.team || 'Unassigned',
      });
      setMessage('Schedule added successfully!');
      setNewScheduleAgent('');
      setNewScheduleDate('');
      setNewScheduleShift('');
    } catch (error) {
      console.error("Error adding schedule:", error);
      setMessage('Failed to add schedule.');
    }
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    try {
      const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
      const newAgentId = `user_${Date.now()}_${newAgentName}`;
      await setDoc(doc(usersRef, newAgentId), {
        id: newAgentId,
        name: newAgentName,
        fullName: newAgentFullName,
        email: newAgentEmail,
        role: newAgentRole,
        team: newAgentTeam,
        tl: newAgentTL,
        status: newAgentRole === 'agent' ? 'Attuned' : null, // Fix: Changed undefined to null
      });
      setMessage('New user added successfully!');
      setNewAgentName('');
      setNewAgentFullName('');
      setNewAgentEmail('');
      setNewAgentRole('agent');
      setNewAgentTeam('');
      setNewAgentTL('');
    } catch (error) {
      console.error("Error adding user:", error);
      setMessage('Failed to add user.');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
      await updateDoc(userDocRef, { role: newRole });
      setMessage(`User role updated to ${newRole}.`);
    } catch (error) {
      console.error("Error changing role:", error);
      setMessage('Failed to change user role.');
    }
  };

  const handleTeamChange = async (userId, newTeam) => {
    try {
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
        const userData = users.find(u => u.id === userId);
        const oldTeam = userData?.team;
        await updateDoc(userDocRef, { team: newTeam });
        setMessage(`Team name for user updated to ${newTeam}.`);

        const schedulesRef = collection(db, `artifacts/${appId}/public/data/schedules`);
        const q = query(schedulesRef, where('agent', '==', userData?.name), where('team', '==', oldTeam));
        const scheduleSnapshot = await getDocs(q);

        scheduleSnapshot.forEach(async (scheduleDoc) => {
            await updateDoc(doc(schedulesRef, scheduleDoc.id), { team: newTeam });
        });
    } catch (error) {
        console.error("Error changing team:", error);
        setMessage('Failed to change user team.');
    }
  };

  const handleApproveJustification = async (justification) => {
      try {
          const justificationDocRef = doc(db, `artifacts/${appId}/public/data/justifications`, justification.id);
          await updateDoc(justificationDocRef, { status: 'approved' });

          const scheduleDocRef = doc(db, `artifacts/${appId}/public/data/schedules`, justification.scheduleId);
          await updateDoc(scheduleDocRef, {
              status: 'Absent',
              absenceReason: justification.reason,
              absenceNotes: justification.notes,
          });

          setMessage(`Absence for ${justification.agent} approved.`);
      } catch (error) {
          console.error("Error approving justification:", error);
          setMessage("Failed to approve justification.");
      }
  };

  const handleDenyJustification = async (justificationId) => {
      try {
          const justificationDocRef = doc(db, `artifacts/${appId}/public/data/justifications`, justificationId);
          await updateDoc(justificationDocRef, { status: 'denied' });
          setMessage("Absence justification denied.");
      } catch (error) {
          console.error("Error denying justification:", error);
          setMessage("Failed to deny justification.");
      }
  };


  const handleExport = () => {
    if (!xlsxLoaded) {
      setMessage("Excel library is not yet loaded.");
      return;
    }
    const schedulesToExport = schedules.map(({ id, ...rest }) => rest);
    const worksheet = window.XLSX.utils.json_to_sheet(schedulesToExport);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Schedules");
    window.XLSX.writeFile(workbook, "schedules.xlsx");
    setMessage("Schedules exported to schedules.xlsx");
  };

  const handleImportSchedules = async (e) => {
    if (!xlsxLoaded) {
      setMessage("Excel library is not yet loaded.");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        const schedulesRef = collection(db, `artifacts/${appId}/public/data/schedules`);
        for (const schedule of json) {
          if (schedule.agent && schedule.date && schedule.shift) {
            await addDoc(schedulesRef, {
              agent: schedule.agent,
              date: schedule.date,
              shift: schedule.shift,
              day: new Date(schedule.date).toLocaleString('en-US', { weekday: 'long' }),
              team: schedule.team || 'Unassigned',
            });
          }
        }
        setMessage("Schedules imported successfully!");
      } catch (error) {
        console.error("Error importing schedules:", error);
        setMessage("Failed to import schedules.");
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleImportAgents = async (e) => {
    if (!xlsxLoaded) {
      setMessage("Excel library is not yet loaded.");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
        for (const user of json) {
          if (user.name && user.fullName) {
            const userId = `user_${user.name.toLowerCase().replace(/\s/g, '_')}_${Date.now()}`;
            await setDoc(doc(usersRef, userId), {
              id: userId,
              name: user.name,
              fullName: user.fullName,
              email: user.email || '',
              role: user.role || 'agent',
              team: user.team || 'Unassigned',
              tl: user.tl || '',
              status: user.status || (user.role === 'agent' ? 'Attuned' : null),
            });
          }
        }
        setMessage("Agents imported successfully!");
      } catch (error) {
        console.error("Error importing agents:", error);
        setMessage("Failed to import agents.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredSchedules = filteredAgent === 'all'
    ? schedules
    : schedules.filter(s => s.agent === filteredAgent);

  const uniqueTeams = [...new Set(users.filter(u => u.team).map(u => u.team))];
  const tls = users.filter(user => user.role === 'tl');

  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 shadow-md text-sm"
        >
          <Key className="mr-2" size={16} />
          Change Password
        </button>
      </div>
      {/* Pending Justifications Section */}
      <div className="bg-red-50 p-6 rounded-xl shadow-inner border border-red-200">
        <h2 className="2xl font-bold text-red-800 mb-4 flex items-center">
          <ArrowRightLeft className="mr-2" />
          Pending Absence Justifications
        </h2>
        {justifications.length > 0 ? (
          <JustificationList
            justifications={justifications}
            onApprove={handleApproveJustification}
            onDeny={handleDenyJustification}
          />
        ) : (
          <p className="text-gray-600">No pending justifications to review.</p>
        )}
      </div>
      {/* Schedule Management */}
      <div className="bg-blue-50 p-6 rounded-xl shadow-inner border border-blue-200">
        <h2 className="2xl font-bold text-blue-800 mb-4 flex items-center">
          <Calendar className="mr-2" />
          All Team Schedules
        </h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Agent</label>
          <select
            value={filteredAgent}
            onChange={(e) => setFilteredAgent(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Agents</option>
            {users.map(user => (
              <option key={user.id} value={user.name}>{user.name}</option>
            ))}
          </select>
        </div>
        {filteredSchedules.length > 0 ? (
          <ScheduleList schedules={filteredSchedules} />
        ) : (
          <p className="text-gray-600">No schedules found for the selected agent.</p>
        )}
      </div>

      {/* Add Schedule Section */}
      <div className="bg-purple-50 p-6 rounded-xl shadow-inner border border-purple-200">
        <h2 className="2xl font-bold text-purple-800 mb-4 flex items-center">
          <PlusCircle className="mr-2" />
          Add New Schedule
        </h2>
        <form onSubmit={handleAddSchedule} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
              <select
                value={newScheduleAgent}
                onChange={(e) => setNewScheduleAgent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              >
                <option value="">Select Agent</option>
                {users.map(user => (
                  <option key={user.id} value={user.name}>{user.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
              <input
                type="text"
                value={newScheduleShift}
                onChange={(e) => setNewScheduleShift(e.target.value)}
                placeholder="e.g., 09:00 - 17:00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-3 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-colors duration-200 shadow-md flex items-center justify-center"
          >
            <PlusCircle className="mr-2" size={20} />
            Add Schedule
          </button>
        </form>
      </div>

      {/* User Management Section */}
      <div className="bg-yellow-50 p-6 rounded-xl shadow-inner border border-yellow-200">
        <h2 className="2xl font-bold text-yellow-800 mb-4 flex items-center">
          <UserCog className="mr-2" />
          Manage Users
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Username</th>
                <th className="py-3 px-6 text-left">Full Name</th>
                <th className="py-3 px-6 text-left">Email</th>
                <th className="py-3 px-6 text-left">Role</th>
                <th className="py-3 px-6 text-left">Team</th>
                <th className="py-3 px-6 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-6 text-left whitespace-nowrap">{user.name}</td>
                  <td className="py-3 px-6 text-left">{user.fullName}</td>
                  <td className="py-3 px-6 text-left">{user.email}</td>
                  <td className="py-3 px-6 text-left">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="agent">Agent</option>
                      <option value="tl">TL</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-6 text-left">
                    {(user.role === 'tl' || user.role === 'agent') ? (
                       <input
                          type="text"
                          value={user.team || ''}
                          onChange={(e) => handleTeamChange(user.id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm w-32"
                          placeholder="Team Name"
                      />
                    ) : (
                      <span>{user.team}</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-left">{user.status || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add New Agents Section */}
      <div className="bg-pink-50 p-6 rounded-xl shadow-inner border border-pink-200">
        <h2 className="2xl font-bold text-pink-800 mb-4 flex items-center">
          <UserPlus className="mr-2" />
          Add New User
        </h2>
        <form onSubmit={handleAddAgent} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                placeholder="e.g., new_user"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={newAgentFullName}
                onChange={(e) => setNewAgentFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                placeholder="e.g., New User Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={newAgentEmail}
                onChange={(e) => setNewAgentEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                placeholder="e.g., user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                required
              >
                <option value="agent">Agent</option>
                <option value="tl">TL</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {newAgentRole !== 'admin' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                  <input
                    type="text"
                    value={newAgentTeam}
                    onChange={(e) => setNewAgentTeam(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="e.g., Team A"
                    required={newAgentRole !== 'admin'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Lead</label>
                  <select
                    value={newAgentTL}
                    onChange={(e) => setNewAgentTL(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    required={newAgentRole === 'agent'}
                  >
                    <option value="">Select TL</option>
                    {tls.map(tl => (
                      <option key={tl.id} value={tl.name}>{tl.fullName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-3 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 transition-colors duration-200 shadow-md flex items-center justify-center"
          >
            <UserPlus className="mr-2" size={20} />
            Add New User
          </button>
        </form>
      </div>

      {/* Excel Import/Export Section */}
      <div className="bg-indigo-50 p-6 rounded-xl shadow-inner border border-indigo-200">
        <h2 className="2xl font-bold text-indigo-800 mb-4 flex items-center">
          <Download className="mr-2" />
          Data Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleExport}
            className={`w-full flex justify-center items-center py-3 text-white font-bold rounded-lg shadow-md ${xlsxLoaded ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-400 cursor-not-allowed'}`}
            disabled={!xlsxLoaded}
          >
            <Download className="mr-2" size={20} />
            Export Schedules to Excel
          </button>
          <label className={`w-full flex items-center justify-center py-3 text-white font-bold rounded-lg shadow-md ${xlsxLoaded ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
            <Upload className="mr-2" size={20} />
            Import Schedules from Excel
            <input type="file" onChange={handleImportSchedules} className="hidden" accept=".xlsx, .xls" disabled={!xlsxLoaded} />
          </label>
        </div>
        <div className="mt-4">
           <label className={`w-full flex items-center justify-center py-3 text-white font-bold rounded-lg shadow-md ${xlsxLoaded ? 'bg-teal-500 hover:bg-teal-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
            <Upload className="mr-2" size={20} />
            Import Agents from Excel
            <input type="file" onChange={handleImportAgents} className="hidden" accept=".xlsx, .xls" disabled={!xlsxLoaded} />
          </label>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-800 text-white rounded-lg shadow-xl text-center z-50">
          {message}
        </div>
      )}
      {showPasswordModal && (
        <PasswordChangeModal
          onClose={() => setShowPasswordModal(false)}
          onPasswordChange={onPasswordChange}
          username={username}
        />
      )}
    </div>
  );
}

// Justification List Component
function JustificationList({ justifications, onApprove, onDeny }) {
  return (
    <ul className="space-y-4">
      {justifications.map(justification => (
        <li key={justification.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <p className="text-gray-800 font-medium">
                <span className="font-bold text-blue-600">{justification.agent}</span> marked absent by <span className="font-bold text-blue-600">{justification.submittedBy}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Date: <span className="font-mono">{justification.date}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Reason: <span className="font-bold text-red-500">{justification.reason}</span>
              </p>
              {justification.notes && (
                <p className="text-sm text-gray-600 mt-1">
                  Notes: <span className="italic">{justification.notes}</span>
                </p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ml-4 ${
                justification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                justification.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}
            >
              {justification.status}
            </span>
          </div>
          {justification.status === 'pending' && (
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => onApprove(justification)}
                className="flex-1 flex items-center justify-center py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 shadow-md text-sm"
              >
                <Check className="mr-2" size={16} />
                Approve
              </button>
              <button
                onClick={() => onDeny(justification.id)}
                className="flex-1 flex items-center justify-center py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-md text-sm"
              >
                X
                Deny
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// Reusable Schedule List Component
function ScheduleList({ schedules, onMarkAbsent }) {
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    (acc[schedule.date] = acc[schedule.date] || []).push(schedule);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedSchedules).sort();

  return (
    <div className="space-y-4">
      {sortedDates.map(date => (
        <div key={date} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{date}</h3>
          <ul className="divide-y divide-gray-200">
            {groupedSchedules[date].map((schedule, index) => (
              <li key={index} className="flex justify-between items-center py-2">
                <div className="flex-1">
                  <span className="text-gray-800 font-medium">{schedule.agent}</span>
                  <span className="text-gray-600 text-sm ml-2">{schedule.shift}</span>
                  {schedule.status === 'Absent' && (
                    <span className="ml-2 text-red-500 font-bold text-sm">
                      (Absent: {schedule.absenceReason})
                    </span>
                  )}
                </div>
                {onMarkAbsent && schedule.status !== 'Absent' && (
                  <button 
                    onClick={() => onMarkAbsent(schedule)} 
                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600"
                  >
                    Mark Absent
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Reusable Swap Request List Component
function SwapRequestList({ requests, showActions, onApprove, onDeny }) {
  return (
    <ul className="space-y-4">
      {requests.map(request => (
        <li key={request.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <p className="text-gray-800 font-medium">
                <span className="font-bold text-blue-600">{request.requesterId}</span> wants to swap with <span className="font-bold text-blue-600">{request.recipientId}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                For: <span className="font-mono">{request.date}</span> at <span className="font-mono">{request.newShift}</span>
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ml-4 ${
                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}
            >
              {request.status}
            </span>
          </div>
          {showActions && (
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => onApprove(request)}
                className="flex-1 flex items-center justify-center py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 shadow-md text-sm"
              >
                <Check className="mr-2" size={16} />
                Approve
              </button>
              <button
                onClick={() => onDeny(request.id)}
                className="flex-1 flex items-center justify-center py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-md text-sm"
              >
                X
                Deny
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// Password Change Modal Component
function PasswordChangeModal({ onClose, onPasswordChange, username }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onPasswordChange(newPassword);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Change Password for {username}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Absence Justification Modal Component
function AbsenceJustificationModal({ onClose, onSubmit, agentName }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Please select a reason.');
      return;
    }
    onSubmit(reason, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Mark {agentName} as Absent</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Absence</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="">Select Reason</option>
              <option value="Sick">Sick</option>
              <option value="Casual">Casual</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Add more details about the absence..."
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
            >
              Submit Justification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
