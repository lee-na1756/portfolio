
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".contact-form");
    const success = document.getElementById("contact-success");
    const error = document.getElementById("contact-error");

    if (!form || !success || !error) return;

    const button = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        error.hidden = true;
        button.disabled = true;
        button.textContent = "SENDING...";

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("送信に失敗しました");
            }

            // 送信成功時だけフォームを非表示にする
            form.hidden = true;
            success.hidden = false;

            success.querySelector(".contact-form__success-title").focus();

        } catch (err) {
            // 失敗時はフォームを残してエラーを表示
            error.hidden = false;
        } finally {
            button.disabled = false;
            button.textContent = "SEND";
        }
    });
});
