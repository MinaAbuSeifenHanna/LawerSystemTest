import{a,s as o}from"./auth-D1Y-1cw6.js";import{g as r}from"./db-services-Ds2mt6SM.js";import{s,a as i,h as d}from"./ui-utils-rfZbPk50.js";document.getElementById("sidebarCollapse").addEventListener("click",()=>{document.getElementById("sidebar").classList.toggle("active")});document.getElementById("btnLogout").addEventListener("click",e=>{e.preventDefault(),a()});s();o(async(e,t)=>{if(e){document.getElementById("lawyerName").innerText=t?.lawyerName||e.email;try{await l()}catch(n){console.error(n),i("error","حدث خطأ في تحميل البيانات")}d()}else window.location.replace("login.html")},()=>{window.location.replace("login.html")});async function l(){const e=await r();document.getElementById("totalClients").innerText=e.totalClients,document.getElementById("activeCases").innerText=e.activeCases,document.getElementById("totalPendingFees").innerText=e.totalPendingFees+" ج.م";const t=document.getElementById("upcomingHearingsBody");t.innerHTML="",e.upcomingHearings.length===0?t.innerHTML='<tr><td colspan="3" class="text-center">لا توجد جلسات قادمة خلال 7 أيام</td></tr>':e.upcomingHearings.forEach(n=>{t.innerHTML+=`
                        <tr>
                            <td>${n.caseNo}</td>
                            <td>${n.court}</td>
                            <td>${n.nextHearingDate}</td>
                        </tr>
                    `})}
