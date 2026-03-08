import { getPendingFeesDetails, addPayment, addExpense, deleteFinancialTransaction, memoryCache, getClientAccountStatement, getFinancialSummary } from './db-services.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, getEmptyStateHTML, showConfirmDialog } from './ui-utils.js';
// We'll dynamically import the pdf-service to keep initial load light

export async function initFinancesUI() {
    console.log('initFinancesUI: starting');

    // Initial render from cache
    if (memoryCache.transactions) {
        renderFinances(memoryCache.transactions);
    } else {
        showSpinner();
    }

    if (memoryCache.cases) {
        populateCaseDropdowns();
    }

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const paymentDateInput = document.querySelector('#addPaymentForm input[name="paymentDate"]');
    const expenseDateInput = document.querySelector('#addExpenseForm input[name="expenseDate"]');
    if (paymentDateInput) paymentDateInput.value = today;
    if (expenseDateInput) expenseDateInput.value = today;

    // Listen for real-time updates (remove existing first to avoid duplicates)
    window.removeEventListener('transactionsUpdated', window._onTransactionsUpdate);
    window._onTransactionsUpdate = (e) => {
        console.log('transactionsUpdated event received');
        renderFinances(e.detail || []);
        hideSpinner();
    };
    window.addEventListener('transactionsUpdated', window._onTransactionsUpdate);

    window.removeEventListener('casesUpdated', window._onCasesUpdateFinances);
    window._onCasesUpdateFinances = () => {
        populateCaseDropdowns();
    };
    window.addEventListener('casesUpdated', window._onCasesUpdateFinances);

    // Filter functionality
    const transactionFilter = document.getElementById('transactionFilter');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', (e) => {
            renderFinances(memoryCache.transactions || [], e.target.value);
        });
    }

    // Add Payment Form
    const addPaymentForm = document.getElementById('addPaymentForm');
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const caseId = formData.get('caseId');
            const amount = parseFloat(formData.get('amount'));

            if (!caseId) {
                showToast('error', 'يجب اختيار القضية');
                return;
            }

            const cases = memoryCache.cases || [];
            const selectedCase = cases.find(c => c.id === caseId);

            if (!selectedCase) {
                showToast('error', 'القضية المختارة غير موجودة');
                return;
            }

            const paymentData = {
                caseId: caseId,
                caseNo: selectedCase.caseNo || '',
                clientName: selectedCase.clientName || '',
                amount: amount,
                paymentDate: formData.get('paymentDate'),
                paymentMethod: formData.get('paymentMethod'),
                notes: formData.get('notes') || '',
                description: `دفعة من ${selectedCase.clientName || 'عميل'} للقضية ${selectedCase.caseNo || ''}`
            };

            try {
                showSpinner();
                await addPayment(paymentData);
                const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
                if (modal) modal.hide();
                e.target.reset();
                showToast('success', 'تم إضافة الدفعة بنجاح');
            } catch (error) {
                showToast('error', 'حدث خطأ في إضافة الدفعة');
            } finally {
                hideSpinner();
            }
        });
    }

    // Add Expense Form
    const addExpenseForm = document.getElementById('addExpenseForm');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const amount = parseFloat(formData.get('amount'));

            const caseId = formData.get('caseId');
            let caseInfo = {};
            if (caseId) {
                const cases = memoryCache.cases || [];
                const selectedCase = cases.find(c => c.id === caseId);
                if (selectedCase) {
                    caseInfo = {
                        caseNo: selectedCase.caseNo || '',
                        clientName: selectedCase.clientName || ''
                    };
                }
            }

            const expenseData = {
                category: formData.get('category'),
                amount: amount,
                date: formData.get('expenseDate'), // Mapping expenseDate to 'date' field
                caseId: caseId || null,
                ...caseInfo,
                expenseName: formData.get('expenseName'),
                description: formData.get('expenseName') // Keep description for legacy rendering
            };

            try {
                showSpinner();
                await addExpense(expenseData);
                const modal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
                if (modal) modal.hide();
                e.target.reset();
                showToast('success', 'تم إضافة المصروف بنجاح');
            } catch (error) {
                showToast('error', 'حدث خطأ في إضافة المصروف');
            } finally {
                hideSpinner();
            }
        });
    }
}

function renderFinances(transactions, filter = 'all') {
    // Update Summary Cards from cache stats
    const summary = memoryCache.stats || {};
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalPaidEl = document.getElementById('totalPaid');
    const totalRemainingEl = document.getElementById('totalRemaining');
    const netProfitEl = document.getElementById('netProfit');

    if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(summary.totalRevenue || 0);
    if (totalPaidEl) totalPaidEl.textContent = formatCurrency(summary.totalPaid || 0);
    if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(summary.totalRemaining || 0);

    if (netProfitEl) {
        const netProfitValue = parseFloat(summary.netProfit) || 0;
        netProfitEl.textContent = formatCurrency(netProfitValue);

        // Dynamic coloring for Net Profit
        const cardBody = netProfitEl.closest('.card');
        if (cardBody) {
            cardBody.classList.remove('bg-primary', 'bg-success', 'bg-danger');
            if (netProfitValue > 0) {
                cardBody.classList.add('bg-success');
            } else if (netProfitValue < 0) {
                cardBody.classList.add('bg-danger');
            } else {
                cardBody.classList.add('bg-primary');
            }
        }
    }

    // Filter transactions
    let filtered = transactions;
    if (filter === 'payments') {
        filtered = transactions.filter(t => t.type === 'payment');
    } else if (filter === 'expenses') {
        filtered = transactions.filter(t => t.type === 'expense');
    }

    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        const message = filter === 'all' ? 'لا توجد معاملات مالية بعد' :
            filter === 'payments' ? 'لا توجد دفعات' : 'لا توجد مصروفات';
        tbody.innerHTML = getEmptyStateHTML(message, 'fas fa-receipt');
        return;
    }

    filtered.forEach(transaction => {
        const date = transaction.createdAt ? (transaction.createdAt.toDate ? transaction.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(transaction.createdAt).toLocaleDateString('ar-EG')) : 'غير محدد';
        const type = transaction.type === 'payment' ? 'دفعة' : 'مصروف';
        const typeClass = transaction.type === 'payment' ? 'text-success' : 'text-danger';
        const amount = transaction.amount ? formatCurrency(transaction.amount) : formatCurrency(0);

        tbody.innerHTML += `
            <tr>
                <td data-label="التاريخ">${date}</td>
                <td data-label="النوع"><span class="${typeClass}">${type}</span></td>
                <td data-label="الوصف">${transaction.expenseName || transaction.description || transaction.notes || '-'}</td>
                <td data-label="رقم القضية">${transaction.caseNo || '-'}</td>
                <td data-label="اسم العميل">${transaction.clientName || '-'}</td>
                <td class="${typeClass}" data-label="المبلغ">${amount}</td>
                <td data-label="الإجراءات">
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTransaction('${transaction.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function populateCaseDropdowns() {
    const cases = memoryCache.cases || [];
    const caseSelects = document.querySelectorAll('select[name="caseId"]');

    caseSelects.forEach(select => {
        const firstOption = select.querySelector('option');
        select.innerHTML = firstOption ? firstOption.outerHTML : '';

        cases.forEach(caseItem => {
            const option = document.createElement('option');
            option.value = caseItem.id;
            option.textContent = `${caseItem.caseNo} - ${caseItem.clientName || 'عميل غير محدد'}`;
            select.appendChild(option);
        });
    });
}

// Global functions

window.searchClientStatement = async function () {
    const poa = document.getElementById('clientSearchPOA').value.trim();
    if (!poa) {
        showToast('error', 'يرجى ادخال رقم التوكيل');
        return;
    }

    try {
        showSpinner();
        const data = await getClientAccountStatement(poa);

        const container = document.getElementById('statementResultContainer');
        const exportBtn = document.getElementById('exportStatementBtn');

        if (data.cases.length === 0) {
            showToast('info', 'لا توجد قضايا لهذا العميل');
            container.classList.add('d-none');
            exportBtn.classList.add('d-none');
            return;
        }

        container.classList.remove('d-none');
        exportBtn.classList.remove('d-none');

        // Render Summary
        document.getElementById('statementClientName').textContent = `اسم العميل: ${data.cases[0].clientName}`;
        document.getElementById('statementClientPOA').textContent = `رقم التوكيل: ${poa}`;

        // Render Cases Table
        const tbody = document.getElementById('statementTableBody');
        tbody.innerHTML = '';
        data.cases.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td>${c.caseNo}</td>
                    <td>${formatCurrency(c.totalFees)}</td>
                    <td>${formatCurrency(c.paidAmount)}</td>
                    <td class="text-danger"><strong>${formatCurrency(c.remainingBalance)}</strong></td>
                </tr>
            `;
        });

        // Render History Table
        const historyBody = document.getElementById('statementHistoryTableBody');
        historyBody.innerHTML = '';
        if (data.paymentHistory.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا يوجد سجل مدفوعات</td></tr>';
        } else {
            data.paymentHistory.forEach(h => {
                const date = h.date ? new Date(h.date).toLocaleDateString('ar-EG') : '-';
                historyBody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${h.caseNo}</td>
                        <td class="text-success">${formatCurrency(h.amount)}</td>
                        <td>${h.notes || '-'}</td>
                    </tr>
                `;
            });
        }

        window._currentStatementData = data; // Cache for export
    } catch (error) {
        console.error('Search error:', error);
        showToast('error', 'حدث خطأ في البحث عن كشف الحساب');
    } finally {
        hideSpinner();
    }
};

window.exportGeneralFinancialPDF = async function () {
    try {
        showSpinner();
        const { generatePDF } = await import('./pdf-service.js');
        const summary = memoryCache.stats || {};

        const title = 'التقرير المالي العام';
        const headers = ['المجال', 'القيمة'];
        const data = [
            ['إجمالي الإيرادات', formatCurrency(summary.totalRevenue)],
            ['إجمالي المحصل', formatCurrency(summary.totalPaid)],
            ['إجمالي المتبقي', formatCurrency(summary.totalRemaining)],
            ['صافي الربح', formatCurrency(summary.netProfit)]
        ];

        await generatePDF(title, headers, data, 'financial_report');
        showToast('success', 'تم تصدير التقرير المالي بنجاح');
    } catch (error) {
        console.error('Export error:', error);
        showToast('error', 'حدث خطأ في تصدير التقرير');
    } finally {
        hideSpinner();
    }
};

window.exportClientStatementPDF = async function () {
    const data = window._currentStatementData;
    if (!data) return;

    try {
        showSpinner();
        const { generateAccountStatementPDF } = await import('./pdf-service.js');

        const clientInfo = {
            name: data.cases[0].clientName,
            poa: data.cases[0].powerOfAttorneyNo
        };

        const caseData = data.cases.map(c => ({
            caseNo: c.caseNo,
            totalFees: formatCurrency(c.totalFees),
            paidAmount: formatCurrency(c.paidAmount),
            remainingBalance: formatCurrency(c.remainingBalance)
        }));

        const historyData = data.paymentHistory.map(h => ({
            date: h.date ? new Date(h.date).toLocaleDateString('ar-EG') : '-',
            caseNo: h.caseNo,
            amount: formatCurrency(h.amount)
        }));

        await generateAccountStatementPDF(clientInfo, caseData, historyData);
        showToast('success', 'تم تصدير كشف الحساب بنجاح');
    } catch (error) {
        console.error('Export error:', error);
        showToast('error', 'حدث خطأ في تصدير كشف الحساب');
    } finally {
        hideSpinner();
    }
};

window.deleteTransaction = async function (id) {
    const isConfirmed = await showConfirmDialog(
        'هل أنت متأكد؟',
        'لن تتمكن من استرجاع هذه المعاملة!'
    );

    if (!isConfirmed) return;

    try {
        showSpinner();
        await deleteFinancialTransaction(id);
        showToast('success', 'تم حذف المعاملة بنجاح');
    } catch (error) {
        showToast('error', 'حدث خطأ في حذف المعاملة');
    } finally {
        hideSpinner();
    }
};
