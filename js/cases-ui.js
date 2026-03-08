import { addCase, updateCase, deleteCase, memoryCache } from './db-services.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, getEmptyStateHTML, showConfirmDialog } from './ui-utils.js';

let filteredCases = [];

// Helper function to calculate remaining balance
function calculateRemainingBalance(totalFees, paidAmount) {
    const total = parseFloat(totalFees) || 0;
    const paid = parseFloat(paidAmount) || 0;
    return Math.max(0, total - paid);
}

// Helper function to setup fees calculation in forms
function setupFeesCalculation(form) {
    if (!form) return;
    const totalFeesInput = form.querySelector('[name="totalFees"]');
    const paidAmountInput = form.querySelector('[name="paidAmount"]');
    const remainingBalanceInput = form.querySelector('[name="remainingBalance"]');

    if (totalFeesInput && paidAmountInput && remainingBalanceInput) {
        const updateRemaining = () => {
            const total = parseFloat(totalFeesInput.value) || 0;
            let paid = parseFloat(paidAmountInput.value) || 0;

            if (paid > total) {
                paid = total;
                paidAmountInput.value = paid;
                showToast('warning', 'المبلغ المدفوع لا يمكن أن يتجاوز الأتعاب الإجمالية');
            }

            const remaining = calculateRemainingBalance(total, paid);
            remainingBalanceInput.value = remaining.toFixed(2);
        };

        totalFeesInput.addEventListener('input', updateRemaining);
        paidAmountInput.addEventListener('input', updateRemaining);
        updateRemaining();
    }
}

function populateClientDropdowns() {
    const clients = memoryCache.clients || [];
    const addCaseClientSelect = document.getElementById('addCaseClientSelect');
    const editCaseClientSelect = document.getElementById('editCaseClientSelect');

    let clientOptions = '<option value="">اختر الموكل</option>';
    clients.forEach(client => {
        clientOptions += `<option value="${client.id}" data-name="${client.name}" data-poa="${client.powerOfAttorneyNo}">${client.name} - ${client.powerOfAttorneyNo}</option>`;
    });

    if (addCaseClientSelect) addCaseClientSelect.innerHTML = clientOptions;
    if (editCaseClientSelect) editCaseClientSelect.innerHTML = clientOptions;
}

export async function initCasesUI() {
    console.log('initCasesUI: starting');

    // Initial render from cache
    if (memoryCache.cases) {
        filteredCases = [...memoryCache.cases];
        renderCasesTable(filteredCases);
    } else {
        showSpinner();
    }

    if (memoryCache.clients) {
        populateClientDropdowns();
    }

    // Listen for real-time updates (remove existing first to avoid duplicates)
    window.removeEventListener('casesUpdated', window._onCasesUpdate);
    window._onCasesUpdate = (e) => {
        const cases = e.detail || [];
        const searchInput = document.getElementById('caseSearch');
        const query = searchInput ? searchInput.value.toLowerCase() : '';

        filteredCases = cases.filter(caseItem =>
            caseItem.caseNo.toLowerCase().includes(query) ||
            (caseItem.caseType && caseItem.caseType.toLowerCase().includes(query)) ||
            (caseItem.court && caseItem.court.toLowerCase().includes(query)) ||
            (caseItem.defendant && caseItem.caseType.toLowerCase().includes(query)) ||
            (caseItem.clientName && caseItem.clientName.toLowerCase().includes(query))
        );

        renderCasesTable(filteredCases);
        hideSpinner();
    };
    window.addEventListener('casesUpdated', window._onCasesUpdate);

    window.removeEventListener('clientsUpdated', window._onClientsUpdateDropdown);
    window._onClientsUpdateDropdown = () => {
        populateClientDropdowns();
    };
    window.addEventListener('clientsUpdated', window._onClientsUpdateDropdown);

    // Search functionality
    const searchInput = document.getElementById('caseSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const cases = memoryCache.cases || [];
            filteredCases = cases.filter(caseItem =>
                caseItem.caseNo.toLowerCase().includes(query) ||
                (caseItem.caseType && caseItem.caseType.toLowerCase().includes(query)) ||
                (caseItem.court && caseItem.court.toLowerCase().includes(query)) ||
                (caseItem.defendant && caseItem.defendant.toLowerCase().includes(query)) ||
                (caseItem.clientName && caseItem.clientName.toLowerCase().includes(query))
            );
            renderCasesTable(filteredCases);
        });
    }

    // Forms setup
    const addForm = document.getElementById('addCaseForm');
    if (addForm) {
        setupFeesCalculation(addForm);
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const caseData = Object.fromEntries(formData.entries());

            if (!caseData.caseNo) {
                showToast('error', 'يرجى إدخال رقم القضية');
                return;
            }

            try {
                showSpinner();
                const selectEl = document.getElementById('addCaseClientSelect');
                if (selectEl && selectEl.selectedIndex > 0) {
                    const selectedOption = selectEl.options[selectEl.selectedIndex];
                    caseData.clientName = selectedOption.getAttribute('data-name');
                    caseData.powerOfAttorneyNo = selectedOption.getAttribute('data-poa');
                }

                caseData.remainingBalance = calculateRemainingBalance(caseData.totalFees, caseData.paidAmount);
                await addCase(caseData);

                const modalEl = document.getElementById('addCaseModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                e.target.reset();
                showToast('success', 'تمت إضافة القضية بنجاح');
            } catch (error) {
                showToast('error', 'خطأ: ' + error.message, error);
            } finally {
                hideSpinner();
            }
        });
    }

    const editForm = document.getElementById('editCaseForm');
    if (editForm) {
        setupFeesCalculation(editForm);
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const caseData = Object.fromEntries(formData.entries());
            const { id, ...data } = caseData;

            if (!data.caseNo) {
                showToast('error', 'يرجى إدخال رقم القضية');
                return;
            }

            try {
                showSpinner();
                const selectEl = document.getElementById('editCaseClientSelect');
                if (selectEl && selectEl.selectedIndex > 0) {
                    const selectedOption = selectEl.options[selectEl.selectedIndex];
                    data.clientName = selectedOption.getAttribute('data-name');
                    data.powerOfAttorneyNo = selectedOption.getAttribute('data-poa');
                }

                data.remainingBalance = calculateRemainingBalance(data.totalFees, data.paidAmount);
                await updateCase(id, data);

                const modalEl = document.getElementById('editCaseModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                showToast('success', 'تم تحديث القضية بنجاح');
            } catch (error) {
                showToast('error', 'خطأ: ' + error.message, error);
            } finally {
                hideSpinner();
            }
        });
    }
}

function renderCasesTable(cases) {
    const tbody = document.getElementById('casesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (cases.length === 0) {
        tbody.innerHTML = getEmptyStateHTML('لا توجد قضايا', 'fas fa-gavel');
        return;
    }

    cases.forEach(caseItem => {
        const hearingDate = caseItem.hearingDate ? formatDate(caseItem.hearingDate.toDate ? caseItem.hearingDate.toDate() : new Date(caseItem.hearingDate)) : '---';
        const statusText = caseItem.status === 'Active' ? 'نشطة' : 'مغلقة';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="رقم القضية">${caseItem.caseNo}</td>
            <td data-label="نوع القضية">${caseItem.caseType || '---'}</td>
            <td data-label="المحكمة">${caseItem.court || '---'}</td>
            <td data-label="المدعى عليه">${caseItem.defendant || '---'}</td>
            <td data-label="تاريخ الجلسة">${hearingDate}</td>
            <td data-label="الأتعاب">${caseItem.remainingBalance ? formatCurrency(caseItem.remainingBalance) : '---'}</td>
            <td data-label="الحالة">${statusText}</td>
            <td data-label="الإجراءات">
                <button class="btn btn-sm btn-outline-info me-2" onclick="window.viewCase('${caseItem.id}')" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary me-2" onclick="window.editCase('${caseItem.id}')" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteCase('${caseItem.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '---';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

window.editCase = function (id) {
    const cases = memoryCache.cases || [];
    const caseItem = cases.find(c => c.id === id);
    if (!caseItem) return;

    const form = document.getElementById('editCaseForm');
    if (!form) return;

    form.id.value = caseItem.id;
    form.caseNo.value = caseItem.caseNo || '';
    form.policeReportNo.value = caseItem.policeReportNo || '';
    form.date.value = caseItem.date ? (caseItem.date.toDate ? caseItem.date.toDate().toISOString().split('T')[0] : caseItem.date.split('T')[0]) : '';
    form.fileNo.value = caseItem.fileNo || '';
    form.caseType.value = caseItem.caseType || '';
    form.court.value = caseItem.court || '';
    form.circuit.value = caseItem.circuit || '';
    form.plaintiff.value = caseItem.plaintiff || '';
    form.defendant.value = caseItem.defendant || '';
    form.opposingCounsel.value = caseItem.opposingCounsel || '';
    form.hearingDate.value = caseItem.hearingDate ? (caseItem.hearingDate.toDate ? caseItem.hearingDate.toDate().toISOString().split('T')[0] : caseItem.hearingDate.split('T')[0]) : '';
    form.decision.value = caseItem.decision || '';
    form.nextHearingRequirements.value = caseItem.nextHearingRequirements || '';
    form.status.value = caseItem.status || 'Active';
    form.totalFees.value = caseItem.totalFees || '';
    form.paidAmount.value = caseItem.paidAmount || '';

    if (form.clientId) {
        form.clientId.value = caseItem.clientId || '';
    }

    const editModal = new bootstrap.Modal(document.getElementById('editCaseModal'));
    editModal.show();
};

window.viewCase = function (id) {
    const cases = memoryCache.cases || [];
    const caseItem = cases.find(c => c.id === id);
    if (!caseItem) return;

    document.getElementById('viewCaseClientName').innerText = caseItem.clientName || 'عميل غير محدد';
    document.getElementById('viewCaseClientPoa').innerText = caseItem.powerOfAttorneyNo || 'غير محدد';
    document.getElementById('currentCaseId').value = caseItem.id;

    const remainingBalance = parseFloat(caseItem.remainingBalance) || 0;
    const balanceEl = document.getElementById('viewCaseRemainingBalance');
    balanceEl.innerText = `الأتعاب المتبقية: ${formatCurrency(remainingBalance)}`;

    if (remainingBalance > 0) {
        balanceEl.className = "mt-2 mb-0 text-danger fw-bold";
    } else {
        balanceEl.className = "mt-2 mb-0 text-success fw-bold";
    }

    const viewModal = new bootstrap.Modal(document.getElementById('viewCaseModal'));
    viewModal.show();
};

window.deleteCase = async function (id) {
    const isConfirmed = await showConfirmDialog(
        'هل أنت متأكد؟',
        'لن تتمكن من استرجاع هذه القضية!'
    );

    if (isConfirmed) {
        try {
            showSpinner();
            await deleteCase(id);
            showToast('success', 'تم حذف القضية بنجاح');
        } catch (error) {
            showToast('error', 'حدث خطأ أثناء الحذف: ' + error.message, error);
        } finally {
            hideSpinner();
        }
    }
};
