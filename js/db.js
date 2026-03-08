// Database Operations (CRUD)

// --- Client CRUD ---

async function addClient(clientData) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('clients').add({
        ...clientData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function getClients(callback) {
    if (!currentOfficeId) return;
    return db.collection('offices').doc(currentOfficeId).collection('clients')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const clients = [];
            snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
            callback(clients);
        });
}

async function updateClient(clientId, clientData) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('clients').doc(clientId).update(clientData);
}

async function deleteClient(clientId) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('clients').doc(clientId).delete();
}

// --- Case CRUD ---

async function addCase(caseData) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('cases').add({
        ...caseData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function getCases(callback) {
    if (!currentOfficeId) return;
    return db.collection('offices').doc(currentOfficeId).collection('cases')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const cases = [];
            snapshot.forEach(doc => cases.push({ id: doc.id, ...doc.data() }));
            callback(cases);
        });
}

async function updateCase(caseId, caseData) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('cases').doc(caseId).update(caseData);
}

async function deleteCase(caseId) {
    if (!currentOfficeId) return;
    return await db.collection('offices').doc(currentOfficeId).collection('cases').doc(caseId).delete();
}

// --- Dashboard Stats ---

async function loadDashboardStats() {
    if (!currentOfficeId) return;

    // Clients Count
    const clientsSnap = await db.collection('offices').doc(currentOfficeId).collection('clients').get();
    document.getElementById('totalClients').innerText = clientsSnap.size;

    // Active Cases Count
    const casesSnap = await db.collection('offices').doc(currentOfficeId).collection('cases').get();
    document.getElementById('activeCases').innerText = casesSnap.size;

    // Hearings Today (Simplified query for demo)
    const today = new Date().toISOString().split('T')[0];
    const hearingsSnap = await db.collection('offices').doc(currentOfficeId).collection('cases')
        .where('nextHearingDate', '==', today).get();
    document.getElementById('todayHearings').innerText = hearingsSnap.size;
}
