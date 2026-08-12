(function () {
  "use strict";

  var STORAGE_KEY = "tid2026_registrations";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  function validateName(value) {
    if (!value.trim()) return "이름을 입력해주세요.";
    if (value.trim().length < 2) return "이름은 두 글자 이상 입력해주세요.";
    return "";
  }

  function validateEmail(value) {
    if (!value.trim()) return "이메일을 입력해주세요.";
    if (!EMAIL_RE.test(value.trim())) return "이메일 주소에 @ 와 도메인이 필요해요.";
    return "";
  }

  function setFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  var form = document.getElementById("register-form");
  if (!form) return;

  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var nameError = document.getElementById("name-error");
  var emailError = document.getElementById("email-error");
  var successPanel = document.getElementById("register-success");
  var successDetail = document.getElementById("success-detail");
  var registerAgain = document.getElementById("register-again");

  nameInput.addEventListener("blur", function () {
    setFieldError(nameInput, nameError, validateName(nameInput.value));
  });
  emailInput.addEventListener("blur", function () {
    setFieldError(emailInput, emailError, validateEmail(emailInput.value));
  });

  nameInput.addEventListener("input", function () {
    if (nameInput.getAttribute("aria-invalid") === "true") {
      setFieldError(nameInput, nameError, validateName(nameInput.value));
    }
  });
  emailInput.addEventListener("input", function () {
    if (emailInput.getAttribute("aria-invalid") === "true") {
      setFieldError(emailInput, emailError, validateEmail(emailInput.value));
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var nameMsg = validateName(nameInput.value);
    var emailMsg = validateEmail(emailInput.value);
    setFieldError(nameInput, nameError, nameMsg);
    setFieldError(emailInput, emailError, emailMsg);

    if (nameMsg) {
      nameInput.focus();
      return;
    }
    if (emailMsg) {
      emailInput.focus();
      return;
    }

    var list = loadRegistrations();
    var email = emailInput.value.trim().toLowerCase();
    var already = list.some(function (item) {
      return item.email === email;
    });

    if (already) {
      setFieldError(emailInput, emailError, "이미 이 이메일로 신청된 내역이 있어요.");
      emailInput.focus();
      return;
    }

    list.push({
      name: nameInput.value.trim(),
      email: email,
      createdAt: new Date().toISOString(),
    });
    saveRegistrations(list);

    successDetail.textContent =
      nameInput.value.trim() + "님, 참가 신청이 접수되었습니다. 자세한 안내는 이메일로 보내드릴게요.";
    form.hidden = true;
    successPanel.hidden = false;
    if (typeof successPanel.scrollIntoView === "function") {
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  registerAgain.addEventListener("click", function () {
    form.reset();
    setFieldError(nameInput, nameError, "");
    setFieldError(emailInput, emailError, "");
    successPanel.hidden = true;
    form.hidden = false;
    nameInput.focus();
  });
})();
