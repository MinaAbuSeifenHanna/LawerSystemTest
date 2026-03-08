import { db, auth } from './config.js';
import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    query, where, onSnapshot, serverTimestamp, getDocs, orderBy, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- Global Listener Registry ---
const activeListeners = [];
export const memoryCache = {
    clients: null,
    cases: null,
    transactions: null,
    stats: null
};

let isListening = false;

export function clearAllListeners() {
    console.log(`Clearing ${activeListeners.length} active Firestore listeners...`);
    activeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    activeListeners.length = 0; // Clear the array

    // Clear cache
    memoryCache.clients = null;
    memoryCache.cases = null;
    memoryCache.transactions = null;
    memoryCache.transactions = null;
    memoryCache.stats = null;
    isListening = false;
}

export function startGlobalListeners() {
    if (isListening) {
        console.log('db-services: Listeners already active, skipping...');
        return;
    }
    console.log('db-services: Starting global listeners');
    isListening = true;
    subscribeClients((data) => {
        memoryCache.clients = data;
        window.dispatchEvent(new CustomEvent('clientsUpdated', { detail: data }));
    });

    subscribeCases((data) => {
        memoryCache.cases = data;
        window.dispatchEvent(new CustomEvent('casesUpdated', { detail: data }));

        // Recalculate stats whenever cases change
        updateGlobalStats();
    });

    // Also subscribe to transactions if needed for real-time dashboard
    const ownerId = auth.currentUser?.uid;
    if (ownerId) {
        const q = query(collection(db, 'financial_transactions'), where("ownerId", "==", ownerId));
        const unsub = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            memoryCache.transactions = txs;
            window.dispatchEvent(new CustomEvent('transactionsUpdated', { detail: txs }));
            updateGlobalStats();
        });
        activeListeners.push(unsub);
    }
}

async function updateGlobalStats() {
    try {
        if (memoryCache.clients && memoryCache.cases) {
            const dashboardStats = await getDashboardStats();
            const financialSummary = await getFinancialSummary();

            // Merge both into stats
            const stats = { ...dashboardStats, ...financialSummary };
            memoryCache.stats = stats;
            window.dispatchEvent(new CustomEvent('statsUpdated', { detail: stats }));
        }
    } catch (e) {
        console.error('Stats update error:', e);
    }
}

// --- Client CRUD ---

export async function addClient(data) {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('addClient: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const dataToSave = {
            ...data,
            ownerId: ownerId,
            createdAt: serverTimestamp()
        };
        console.log('addClient: data to save =', dataToSave);

        const docRef = await addDoc(collection(db, 'clients'), dataToSave);
        console.log('addClient: document saved with ID =', docRef.id);
        return docRef;
    } catch (error) {
        console.error('addClient error:', error);
        throw error;
    }
}

export async function getClients() {
    if (memoryCache.clients) return memoryCache.clients;

    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getClients: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const q = query(
            collection(db, 'clients'),
            where("ownerId", "==", ownerId)
        );

        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('getClients: fetched clients length =', clients.length);
        memoryCache.clients = clients;
        return clients;
    } catch (error) {
        console.error('getClients error:', error);
        throw error;
    }
}

export function subscribeClients(callback) {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('subscribeClients: ownerId =', ownerId);
        if (!ownerId) return () => { };

        const q = query(
            collection(db, 'clients'),
            where("ownerId", "==", ownerId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clients = [];
            snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
            console.log('subscribeClients: real-time clients length =', clients.length);
            callback(clients);
        }, (error) => {
            console.error('subscribeClients error:', error);
        });

        activeListeners.push(unsubscribe);
        return unsubscribe;
    } catch (error) {
        console.error('subscribeClients setup error:', error);
        return () => { };
    }
}

export async function updateClient(id, data) {
    try {
        console.log('updateClient: id =', id, 'data =', data);
        const docRef = doc(db, 'clients', id);
        await updateDoc(docRef, data);
        console.log('updateClient: updated successfully');
    } catch (error) {
        console.error('updateClient error:', error);
        throw error;
    }
}

export async function deleteClient(id) {
    try {
        console.log('deleteClient: id =', id);
        const docRef = doc(db, 'clients', id);
        await deleteDoc(docRef);
        console.log('deleteClient: deleted successfully');
    } catch (error) {
        console.error('deleteClient error:', error);
        throw error;
    }
}

// --- Case CRUD ---

export async function addCase(data) {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('addCase: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const dataToSave = {
            ...data,
            status: data.status || 'Active',
            ownerId: ownerId,
            createdAt: serverTimestamp()
        };
        console.log('addCase: data to save =', dataToSave);

        const docRef = await addDoc(collection(db, 'cases'), dataToSave);
        console.log('addCase: document saved with ID =', docRef.id);
        return docRef;
    } catch (error) {
        console.error('addCase error:', error);
        throw error;
    }
}

export async function getCases() {
    if (memoryCache.cases) return memoryCache.cases;

    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getCases: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const q = query(
            collection(db, 'cases'),
            where("ownerId", "==", ownerId)
        );

        const snapshot = await getDocs(q);
        const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('getCases: fetched cases length =', cases.length);
        memoryCache.cases = cases;
        return cases;
    } catch (error) {
        console.error('getCases error:', error);
        throw error;
    }
}

export function subscribeCases(callback) {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('subscribeCases: ownerId =', ownerId);
        if (!ownerId) return () => { };

        const q = query(
            collection(db, 'cases'),
            where("ownerId", "==", ownerId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cases = [];
            snapshot.forEach(doc => cases.push({ id: doc.id, ...doc.data() }));
            console.log('subscribeCases: real-time cases length =', cases.length);
            callback(cases);
        }, (error) => {
            console.error('subscribeCases error:', error);
        });

        activeListeners.push(unsubscribe);
        return unsubscribe;
    } catch (error) {
        console.error('subscribeCases setup error:', error);
        return () => { };
    }
}

export async function updateCase(id, data) {
    try {
        console.log('updateCase: id =', id, 'data =', data);
        const docRef = doc(db, 'cases', id);
        await updateDoc(docRef, data);
        console.log('updateCase: updated successfully');
    } catch (error) {
        console.error('updateCase error:', error);
        throw error;
    }
}

export async function deleteCase(id) {
    try {
        console.log('deleteCase: id =', id);
        const docRef = doc(db, 'cases', id);
        await deleteDoc(docRef);
        console.log('deleteCase: deleted successfully');
    } catch (error) {
        console.error('deleteCase error:', error);
        throw error;
    }
}

export async function getDashboardStats() {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getDashboardStats: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        // Get data from memoryCache or fetch if empty
        const cases = memoryCache.cases || await getCases();
        const clients = memoryCache.clients || await getClients();

        // Calculate stats
        const totalClients = clients.length;
        const activeCases = cases.filter(c => c.status === 'Active' || c.status === 'نشطة').length;

        // Calculate total pending fees from cached cases
        let totalPendingFees = 0;
        cases.forEach(c => {
            if ((c.status === 'Active' || c.status === 'نشطة') && c.remainingBalance) {
                totalPendingFees += parseFloat(c.remainingBalance) || 0;
            }
        });

        // Get upcoming hearings (next 7 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);

        console.log('getDashboardStats: checking upcoming hearings for', cases.length, 'cases');
        console.log('getDashboardStats: today =', today.toISOString().split('T')[0], 'next7Days =', next7Days.toISOString().split('T')[0]);

        const upcomingHearings = cases
            .filter(caseItem => {
                if (!caseItem.hearingDate) {
                    console.log('getDashboardStats: case', caseItem.caseNo, 'has no hearingDate');
                    return false;
                }

                let hearingDate;
                try {
                    // Handle different date formats (string, Date object, Firestore timestamp)
                    if (typeof caseItem.hearingDate === 'string') {
                        hearingDate = new Date(caseItem.hearingDate);
                    } else if (caseItem.hearingDate && caseItem.hearingDate.toDate) {
                        // Firestore timestamp
                        hearingDate = caseItem.hearingDate.toDate();
                    } else {
                        hearingDate = new Date(caseItem.hearingDate);
                    }

                    if (isNaN(hearingDate.getTime())) {
                        console.log('getDashboardStats: invalid date for case', caseItem.caseNo, caseItem.hearingDate);
                        return false;
                    }

                    hearingDate.setHours(0, 0, 0, 0); // Reset time for date comparison
                    const isUpcoming = hearingDate >= today && hearingDate <= next7Days;
                    console.log('getDashboardStats: case', caseItem.caseNo, 'hearingDate =', hearingDate.toISOString().split('T')[0], 'isUpcoming =', isUpcoming);
                    return isUpcoming;
                } catch (error) {
                    console.warn('Invalid date format for case:', caseItem.caseNo, caseItem.hearingDate, error);
                    return false;
                }
            })
            .map(caseItem => {
                let hearingDate;
                try {
                    if (typeof caseItem.hearingDate === 'string') {
                        hearingDate = new Date(caseItem.hearingDate);
                    } else if (caseItem.hearingDate && caseItem.hearingDate.toDate) {
                        hearingDate = caseItem.hearingDate.toDate();
                    } else {
                        hearingDate = new Date(caseItem.hearingDate);
                    }
                } catch (error) {
                    hearingDate = new Date();
                }

                return {
                    caseNo: caseItem.caseNo,
                    court: caseItem.court,
                    nextHearingDate: formatDate(hearingDate)
                };
            })
            .sort((a, b) => {
                try {
                    return new Date(a.nextHearingDate.split('/').reverse().join('-')) - new Date(b.nextHearingDate.split('/').reverse().join('-'));
                } catch (error) {
                    return 0;
                }
            });

        const stats = {
            totalClients,
            activeCases,
            totalPendingFees: totalPendingFees.toFixed(2),
            upcomingHearings
        };

        console.log('getDashboardStats: calculated stats =', stats);
        return stats;

    } catch (error) {
        console.error('getDashboardStats error:', error);
        throw error;
    }
}

// Helper function for date formatting
function formatDate(date) {
    if (!date) return '---';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export async function getPendingFeesDetails() {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getPendingFeesDetails: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        // Get cases with pending fees
        const cases = await getCases();
        const clients = await getClients();

        // Create a map of client data for quick lookup
        const clientMap = {};
        clients.forEach(client => {
            clientMap[client.id] = client;
        });

        // Filter cases with remaining balance and add client info
        const pendingFeesDetails = cases
            .filter(caseItem => caseItem.remainingBalance && parseFloat(caseItem.remainingBalance) > 0)
            .map(caseItem => {
                const client = clientMap[caseItem.clientId];
                return {
                    caseId: caseItem.id,
                    caseNo: caseItem.caseNo,
                    clientName: client ? client.name : 'عميل غير معروف',
                    clientPhone: client ? client.mobile : '', // Changed from .phone to .mobile
                    remainingBalance: parseFloat(caseItem.remainingBalance),
                    totalFees: caseItem.totalFees || 0,
                    paidAmount: (parseFloat(caseItem.totalFees || 0) - parseFloat(caseItem.remainingBalance)).toFixed(2),
                    court: caseItem.court || '',
                    status: caseItem.status || 'غير محدد'
                };
            })
            .sort((a, b) => b.remainingBalance - a.remainingBalance); // Sort by remaining balance descending

        console.log('getPendingFeesDetails: found', pendingFeesDetails.length, 'cases with pending fees');
        return pendingFeesDetails;

    } catch (error) {
        console.error('getPendingFeesDetails error:', error);
        throw error;
    }
}

// --- Remaining Fees Total ---
export async function getRemainingFeesTotal() {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getRemainingFeesTotal: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const q = query(
            collection(db, 'cases'),
            where("ownerId", "==", ownerId),
            where("status", "in", ["Active", "نشطة"]) // Only count active cases
        );

        const snapshot = await getDocs(q);
        let total = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.remainingBalance && parseFloat(data.remainingBalance) > 0) {
                total += parseFloat(data.remainingBalance);
            }
        });

        console.log('getRemainingFeesTotal: Total =', total);
        return total;
    } catch (error) {
        console.error('getRemainingFeesTotal error:', error);
        throw error;
    }
}

// --- Financial Transactions CRUD ---

export async function addPayment(data) {
    try {
        const ownerId = auth.currentUser?.uid;
        if (!ownerId) throw new Error("User not authenticated");

        await runTransaction(db, async (transaction) => {
            const caseRef = doc(db, 'cases', data.caseId);
            const caseDoc = await transaction.get(caseRef);

            if (!caseDoc.exists()) {
                throw new Error("Case does not exist!");
            }

            const caseData = caseDoc.data();
            const totalFees = parseFloat(caseData.totalFees) || 0;
            const currentPaid = parseFloat(caseData.paidAmount) || 0;
            const newAmount = parseFloat(data.amount) || 0;

            const newPaidTotal = currentPaid + newAmount;
            const newRemaining = Math.max(0, totalFees - newPaidTotal);

            // 1. Update Case
            transaction.update(caseRef, {
                paidAmount: newPaidTotal.toFixed(2),
                remainingBalance: newRemaining.toFixed(2)
            });

            // 2. Create Transaction Record in finance_logs
            const logRef = doc(collection(db, 'finance_logs'));
            transaction.set(logRef, {
                ...data,
                type: 'income',
                ownerId: ownerId,
                createdAt: serverTimestamp()
            });

            // 3. Maintain legacy financial_transactions
            const txRef = doc(collection(db, 'financial_transactions'));
            transaction.set(txRef, {
                ...data,
                type: 'payment',
                ownerId: ownerId,
                createdAt: serverTimestamp()
            });
        });

        console.log('addPayment: Transaction successfully committed');
        return { success: true };
    } catch (error) {
        console.error('addPayment error:', error);
        throw error;
    }
}

export async function addExpense(data) {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('addExpense: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const dataToSave = {
            ...data,
            type: 'expense',
            ownerId: ownerId,
            createdAt: serverTimestamp()
        };
        console.log('addExpense: data to save =', dataToSave);

        const docRef = await addDoc(collection(db, 'financial_transactions'), dataToSave);
        console.log('addExpense: document saved with ID =', docRef.id);
        return docRef;
    } catch (error) {
        console.error('addExpense error:', error);
        throw error;
    }
}

export async function getFinancialTransactions() {
    try {
        const ownerId = auth.currentUser?.uid;
        console.log('getFinancialTransactions: ownerId =', ownerId);
        if (!ownerId) throw new Error("User not authenticated");

        const q = query(
            collection(db, 'financial_transactions'),
            where("ownerId", "==", ownerId)
        );

        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort locally by createdAt desc to avoid requiring a composite index
        transactions.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        console.log('getFinancialTransactions: fetched transactions length =', transactions.length);
        return transactions;
    } catch (error) {
        console.error('getFinancialTransactions error:', error);
        throw error;
    }
}

export async function getFinancialSummary() {
    try {
        const ownerId = auth.currentUser?.uid;
        if (!ownerId) throw new Error("User not authenticated");

        const transactions = memoryCache.transactions || await getFinancialTransactions();
        const cases = memoryCache.cases || await getCases();

        let totalRevenue = 0; // إجمالي الإيرادات (Sum totalFees)
        let totalPaid = 0;    // إجمالي المحصل (Sum paidAmount)
        let totalRemaining = 0; // إجمالي المتبقي (Revenue - Paid)
        let totalExpenses = 0;

        // Sum up from cases
        cases.forEach(c => {
            totalRevenue += parseFloat(c.totalFees) || 0;
            totalPaid += parseFloat(c.paidAmount) || 0;
            totalRemaining += parseFloat(c.remainingBalance) || 0;
        });

        // Sum up expenses from transactions ledger
        transactions.forEach(t => {
            if (t.type === 'expense') {
                totalExpenses += parseFloat(t.amount) || 0;
            }
        });

        // Net Profit = Total Paid - Total Expenses
        const netProfit = totalPaid - totalExpenses;

        const summary = {
            totalRevenue: totalRevenue.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            totalRemaining: totalRemaining.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
            netProfit: netProfit.toFixed(2)
        };

        console.log('getFinancialSummary: calculated summary =', summary);
        return summary;
    } catch (error) {
        console.error('getFinancialSummary error:', error);
        throw error;
    }
}

/**
 * Fetch client account statement: cases and payment logs for a specific POA
 */
export async function getClientAccountStatement(poa) {
    try {
        const ownerId = auth.currentUser?.uid;
        if (!ownerId) throw new Error("User not authenticated");

        // 1. Get all cases for this client
        const cases = memoryCache.cases || await getCases();
        const clientCases = cases.filter(c => c.powerOfAttorneyNo === poa);

        // 2. Get all payment logs for these cases from finance_logs
        const q = query(
            collection(db, 'finance_logs'),
            where("ownerId", "==", ownerId)
        );
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Map logs to relevant cases
        const caseIds = clientCases.map(c => c.id);
        const paymentHistory = logs.filter(log => caseIds.includes(log.caseId));

        return {
            cases: clientCases,
            paymentHistory: paymentHistory.sort((a, b) => {
                const dayA = new Date(a.date).getTime();
                const dayB = new Date(b.date).getTime();
                return dayB - dayA; // Descending
            })
        };
    } catch (error) {
        console.error('getClientAccountStatement error:', error);
        throw error;
    }
}

export async function deleteFinancialTransaction(id) {
    try {
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, 'financial_transactions', id);
            const txDoc = await transaction.get(txRef);

            if (!txDoc.exists()) throw new Error("Transaction not found");

            const txData = txDoc.data();

            // If it's a payment, we MUST reverse the case balance
            if (txData.type === 'payment' && txData.caseId) {
                const caseRef = doc(db, 'cases', txData.caseId);
                const caseDoc = await transaction.get(caseRef);

                if (caseDoc.exists()) {
                    const caseData = caseDoc.data();
                    const totalFees = parseFloat(caseData.totalFees) || 0;
                    const currentPaid = parseFloat(caseData.paidAmount) || 0;
                    const txAmount = parseFloat(txData.amount) || 0;

                    const reversedPaid = Math.max(0, currentPaid - txAmount);
                    const reversedRemaining = Math.max(0, totalFees - reversedPaid);

                    transaction.update(caseRef, {
                        paidAmount: reversedPaid.toFixed(2),
                        remainingBalance: reversedRemaining.toFixed(2)
                    });
                }
            }

            // Finally delete the transaction record
            transaction.delete(txRef);
        });

        console.log('deleteFinancialTransaction: Success');
    } catch (error) {
        console.error('deleteFinancialTransaction error:', error);
        throw error;
    }
}
