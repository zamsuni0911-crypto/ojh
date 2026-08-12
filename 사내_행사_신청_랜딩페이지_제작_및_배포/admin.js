(function () {
  "use strict";

  var STORAGE_KEY = "tid2026_registrations";

  var body = document.getElementById("reg-body");
  var emptyState = document.getElementById("empty-state");
  var emptyTitle = document.getElementById("empty-title");
  var emptyDesc = document.getElementById("empty-desc");
  var searchInput = document.getElementById("search");
  var statTotal = document.getElementById("stat-total");
  var statLatest = document.getElementById("stat-latest");
  var exportBtn = document.getElementById("export-csv");
  var clearBtn = document.getElementById("clear-all");

  function loadRegistrations() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveRegistrations(list) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function sortedByNewest(list) {
    return list.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function updateStats(list) {
    statTotal.textContent = String(list.length);
    if (list.length === 0) {
      statLatest.textContent = "—";
      return;
    }
    var newest = sortedByNewest(list)[0];
    statLatest.textContent = formatDate(newest.createdAt);
  }

  function removeByEmail(email) {
    var list = loadRegistrations().filter(function (item) {
      return item.email !== email;
    });
    saveRegistrations(list);
    render();
  }

  function render() {
    var all = loadRegistrations();
    updateStats(all);

    var query = searchInput.value.trim().toLowerCase();
    var filtered = sortedByNewest(all).filter(function (item) {
      if (!query) return true;
      return (
        item.name.toLowerCase().indexOf(query) !== -1 ||
        item.email.toLowerCase().indexOf(query) !== -1
      );
    });

    body.innerHTML = "";

    if (all.length === 0) {
      emptyTitle.textContent = "아직 신청 내역이 없습니다";
      emptyDesc.textContent = "참가 신청이 접수되면 이곳에 모여 표시됩니다.";
      emptyState.hidden = false;
      exportBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    exportBtn.disabled = false;
    clearBtn.disabled = false;

    if (filtered.length === 0) {
      emptyTitle.textContent = "검색 결과가 없습니다";
      emptyDesc.textContent = "\u201c" + searchInput.value.trim() + "\u201d 와(과) 일치하는 신청이 없어요.";
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    filtered.forEach(function (item, index) {
      var tr = document.createElement("tr");

      var idxCell = document.createElement("td");
      idxCell.className = "col-index";
      idxCell.textContent = String(index + 1);

      var nameCell = document.createElement("td");
      nameCell.textContent = item.name;

      var emailCell = document.createElement("td");
      emailCell.className = "cell-email";
      emailCell.textContent = item.email;

      var dateCell = document.createElement("td");
      dateCell.className = "cell-date";
      dateCell.textContent = formatDate(item.createdAt);

      var actionCell = document.createElement("td");
      actionCell.className = "col-action";
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "row-delete";
      delBtn.setAttribute("aria-label", item.name + " 신청 삭제");
      delBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
      delBtn.addEventListener("click", function () {
        if (window.confirm(item.name + "님의 신청을 삭제할까요?")) {
          removeByEmail(item.email);
        }
      });
      actionCell.appendChild(delBtn);

      tr.appendChild(idxCell);
      tr.appendChild(nameCell);
      tr.appendChild(emailCell);
      tr.appendChild(dateCell);
      tr.appendChild(actionCell);
      body.appendChild(tr);
    });
  }

  function csvEscape(value) {
    var s = String(value);
    if (/[",\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportCsv() {
    var list = sortedByNewest(loadRegistrations());
    if (list.length === 0) return;

    var rows = [["이름", "이메일", "신청일시"]];
    list.forEach(function (item) {
      rows.push([item.name, item.email, formatDate(item.createdAt)]);
    });

    var csv = rows
      .map(function (r) {
        return r.map(csvEscape).join(",");
      })
      .join("\r\n");

    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "tech-insight-day-registrations.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  searchInput.addEventListener("input", render);
  exportBtn.addEventListener("click", exportCsv);
  clearBtn.addEventListener("click", function () {
    if (window.confirm("모든 신청 내역을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
      saveRegistrations([]);
      render();
    }
  });

  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) render();
  });

  render();
})();
