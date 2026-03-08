import { addClient, updateClient, deleteClient, memoryCache } from './db-services.js';
import { showToast, showSpinner, hideSpinner, showConfirmDialog } from './ui-utils.js';

let filteredClients = [];

export async function initClientsUI() {
    console.log('initClientsUI: starting');

    // Initial render from cache if available
    if (memoryCache.clients) {
        filteredClients = [...memoryCache.clients];
        renderClientsTable(filteredClients);
    } else {
        showSpinner();
    }

    // Listen for real-time updates from db-services
    // Listen for real-time updates (remove existing first to avoid duplicates)
    window.removeEventListener('clientsUpdated', window._onClientsUpdate);
    window._onClientsUpdate = (e) => {
        console.log('clientsUpdated event received');
        const clients = e.detail || [];
        const searchInput = document.getElementById('clientSearch');
        const query = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = clients.filter(client =>
            client.name.toLowerCase().includes(query) ||
            client.phone.toLowerCase().includes(query) ||
            client.powerOfAttorneyNo.toLowerCase().includes(query)
        );

        renderClientsTable(filtered);
        hideSpinner();
    };
    window.addEventListener('clientsUpdated', window._onClientsUpdate);

    // Search functionality
    const searchInput = document.getElementById('clientSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const clients = memoryCache.clients || [];
            filteredClients = clients.filter(client =>
                client.name.toLowerCase().includes(query) ||
                client.nationalId.includes(query) ||
                client.mobile.includes(query) ||
                (client.powerOfAttorneyNo && client.powerOfAttorneyNo.includes(query))
            );
            renderClientsTable(filteredClients);
        });
    }

    // Add client form
    const addForm = document.getElementById('addClientForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const clientData = Object.fromEntries(formData.entries());

            if (!clientData.name || !clientData.nationalId || !clientData.mobile || !clientData.address || !clientData.powerOfAttorneyNo) {
                showToast('error', 'يرجى ملء جميع الحقول المطلوبة');
                return;
            }

            try {
                showSpinner();
                await addClient(clientData);
                const addClientModalEl = document.getElementById('addClientModal');
                const addClientModal = bootstrap.Modal.getInstance(addClientModalEl);
                if (addClientModal) addClientModal.hide();
                e.target.reset();
                showToast('success', 'تمت إضافة الموكل بنجاح');
                // No need to manually update arrays, the listener handles it
            } catch (error) {
                showToast('error', 'خطأ: ' + error.message, error);
            } finally {
                hideSpinner();
            }
        });
    }

    // Edit client form
    const editForm = document.getElementById('editClientForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const clientData = Object.fromEntries(formData.entries());
            const { id, ...data } = clientData;

            if (!data.name || !data.nationalId || !data.mobile || !data.address || !data.powerOfAttorneyNo) {
                showToast('error', 'يرجى ملء جميع الحقول المطلوبة');
                return;
            }

            try {
                showSpinner();
                await updateClient(id, data);
                const editClientModalEl = document.getElementById('editClientModal');
                const editClientModal = bootstrap.Modal.getInstance(editClientModalEl);
                if (editClientModal) editClientModal.hide();
                showToast('success', 'تم تحديث الموكل بنجاح');
            } catch (error) {
                showToast('error', 'خطأ: ' + error.message, error);
            } finally {
                hideSpinner();
            }
        });
    }

    // Cleanup listener on page change (router will handle this if we return a cleanup function or just rely on the fact that the event listener is on window)
    // Actually, for multiple navigations to same page, we might stack listeners.
    // Let's make the listener named so we can remove it if needed, or better, manage it in the router.
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا يوجد موكلين</td></tr>';
        return;
    }

    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="رقم التوكيل">${client.powerOfAttorneyNo || '---'}</td>
            <td data-label="الاسم">${client.name}</td>
            <td data-label="الرقم القومي">${client.nationalId}</td>
            <td data-label="رقم الهاتف">${client.mobile}</td>
            <td data-label="الإجراءات">
                <button class="btn btn-sm btn-outline-primary me-2" onclick="window.editClient('${client.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteClient('${client.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.editClient = function (id) {
    const clients = memoryCache.clients || [];
    const client = clients.find(c => c.id === id);
    if (!client) return;

    const form = document.getElementById('editClientForm');
    if (!form) return;

    form.id.value = client.id;
    form.name.value = client.name;
    form.nationalId.value = client.nationalId;
    form.mobile.value = client.mobile;
    form.address.value = client.address;
    form.powerOfAttorneyNo.value = client.powerOfAttorneyNo;

    const editModal = new bootstrap.Modal(document.getElementById('editClientModal'));
    editModal.show();
};

window.deleteClient = async function (id) {
    const isConfirmed = await showConfirmDialog(
        'هل أنت متأكد؟',
        'لن تتمكن من استرجاع هذا الموكل!'
    );

    if (isConfirmed) {
        try {
            showSpinner();
            await deleteClient(id);
            showToast('success', 'تم حذف الموكل بنجاح');
        } catch (error) {
            showToast('error', 'حدث خطأ أثناء الحذف: ' + error.message, error);
        } finally {
            hideSpinner();
        }
    }
};
