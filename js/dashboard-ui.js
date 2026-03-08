import { memoryCache } from './db-services.js';
import { getProfile } from './auth.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, getEmptyStateHTML } from './ui-utils.js';

export async function initDashboard() {
    console.log('initDashboard: starting');

    // Initial render from cache
    if (memoryCache.stats) {
        renderDashboard(memoryCache.stats);
    } else {
        showSpinner();
    }

    // Load profile (static data for now)
    loadProfile();

    // Listen for real-time updates (remove existing first to avoid duplicates)
    window.removeEventListener('statsUpdated', window._onStatsUpdate);
    window._onStatsUpdate = (e) => {
        console.log('statsUpdated event received');
        const stats = e.detail;
        if (stats) {
            renderDashboard(stats);
            hideSpinner();
        }
    };
    window.addEventListener('statsUpdated', window._onStatsUpdate);

    // Search functionality for upcoming hearings
    const searchInput = document.getElementById('upcomingHearingsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const stats = memoryCache.stats;
            if (!stats || !stats.upcomingHearings) return;

            const filtered = stats.upcomingHearings.filter(h =>
                (h.caseNo && h.caseNo.toLowerCase().includes(searchTerm)) ||
                (h.court && h.court.toLowerCase().includes(searchTerm)) ||
                (h.nextHearingDate && h.nextHearingDate.toLowerCase().includes(searchTerm))
            );

            renderUpcomingHearings(filtered);
        });
    }
}

function renderDashboard(stats) {
    // Update summary cards
    const totalClientsEl = document.getElementById('totalClients');
    const activeCasesEl = document.getElementById('activeCases');
    const totalPendingFeesEl = document.getElementById('totalPendingFees');

    if (totalClientsEl) totalClientsEl.innerText = stats.totalClients || 0;
    if (activeCasesEl) activeCasesEl.innerText = stats.activeCases || 0;
    if (totalPendingFeesEl) totalPendingFeesEl.innerText = formatCurrency(stats.totalPendingFees || 0);

    // Update upcoming hearings table
    renderUpcomingHearings(stats.upcomingHearings);
}

function renderUpcomingHearings(hearingsData) {
    const tbody = document.getElementById('upcomingHearingsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!hearingsData || hearingsData.length === 0) {
        tbody.innerHTML = getEmptyStateHTML('لا توجد جلسات قادمة خلال 7 أيام', 'fas fa-calendar-times');
        return;
    }

    hearingsData.forEach(h => {
        tbody.innerHTML += `
            <tr>
                <td data-label="رقم القضية">${h.caseNo}</td>
                <td data-label="المحكمة">${h.court}</td>
                <td data-label="تاريخ الجلسة">${h.nextHearingDate}</td>
            </tr>
        `;
    });
}

export async function loadProfile() {
    try {
        const result = await getProfile();
        if (result.success) {
            const profile = result.data;
            const elements = {
                'profileLawyerName': profile.lawyerName,
                'profileOfficeName': profile.officeName,
                'profileTaxNumber': profile.taxNumber,
                'profileBarNumber': profile.barNumber,
                'profileAddress': profile.address,
                'profileEmail': profile.email
            };

            for (const [id, value] of Object.entries(elements)) {
                const el = document.getElementById(id);
                if (el) el.textContent = value || '-';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Global functions for buttons in dashboard.html
