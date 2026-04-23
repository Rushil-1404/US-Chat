(function initLogin() {
  const requestForm = document.getElementById("request-otp-form");
  const verifyForm = document.getElementById("verify-otp-form");
  const phoneInput = document.getElementById("phone-number-input");
  const verifyPhoneInput = document.getElementById("verify-phone-number");
  const otpInput = document.getElementById("otp-input");
  const otpStep = document.getElementById("otp-step");
  const requestError = document.getElementById("request-otp-error");
  const verifyError = document.getElementById("verify-otp-error");
  const devCodeHint = document.getElementById("dev-code-hint");
  const resendLink = document.getElementById("resend-link");
  const step1Circle = document.getElementById("step-1-circle");
  const step1Label = document.getElementById("step-1-label");
  const step2Circle = document.getElementById("step-2-circle");
  const step2Label = document.getElementById("step-2-label");

  function showVerifyStep(phoneNumber, devCode) {
    verifyPhoneInput.value = phoneNumber;
    otpStep.classList.remove("opacity-40", "pointer-events-none");
    step1Circle.classList.remove("bg-wa-green", "text-white");
    step1Circle.classList.add("bg-gray-100", "text-gray-400");
    step1Label.classList.remove("text-gray-900");
    step1Label.classList.add("text-gray-400");
    step2Circle.classList.remove("bg-gray-100", "text-gray-400");
    step2Circle.classList.add("bg-wa-green", "text-white");
    step2Label.classList.remove("text-gray-400");
    step2Label.classList.add("text-gray-900");
    otpInput.focus();

    if (devCode) {
      devCodeHint.textContent = `Dev code: ${devCode}`;
      devCodeHint.classList.remove("hidden");
    } else {
      devCodeHint.classList.add("hidden");
    }
  }

  async function requestOtp() {
    requestError.classList.add("hidden");
    const payload = { phone_number: phoneInput.value.trim() };
    try {
      const data = await window.chatApp.request("/api/auth/request-otp", {
        method: "POST",
        body: payload,
      });
      showVerifyStep(data.phone_number, data.dev_code);
      window.chatApp.showToast("Verification code sent.", "success");
    } catch (error) {
      requestError.textContent = error.message;
      requestError.classList.remove("hidden");
    }
  }

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await requestOtp();
  });

  resendLink?.addEventListener("click", async () => {
    await requestOtp();
  });

  verifyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    verifyError.classList.add("hidden");
    try {
      const data = await window.chatApp.request("/api/auth/verify-otp", {
        method: "POST",
        body: {
          phone_number: verifyPhoneInput.value,
          otp: otpInput.value.trim(),
        },
      });
      window.location.href = data.redirect_url;
    } catch (error) {
      verifyError.textContent = error.message;
      verifyError.classList.remove("hidden");
    }
  });
})();
