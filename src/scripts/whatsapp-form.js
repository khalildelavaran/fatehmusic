const initWhatsappForm = () => {

    const form = document.getElementById("quickMessageForm");
    const status = document.getElementById("quickMessageStatus");

    if (!form || form.dataset.initialized) {
        return;
    }

    form.dataset.initialized = "true";


    const whatsappNumber = form.dataset.whatsapp;


    form.addEventListener("submit", (event) => {

        event.preventDefault();


        if (!form.reportValidity()) {
            return;
        }


        const data = new FormData(form);


        const get = (key) =>
            (data.get(key) || "").toString().trim();


        const name = get("name");
        const topic = get("topic");
        const message = get("message");


        const lines = [
            "پیام جدید از سایت - آموزشگاه موسیقی فاتح",
            "",
            `نام: ${name}`
        ];


        if (topic) {
            lines.push(`موضوع: ${topic}`);
        }


        lines.push(
            "",
            message
        );


        const text = lines.join("\n");


        const url =
            `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;


        if (status) {
            status.textContent = "در حال انتقال به واتساپ...";
        }


        form.reset();


        window.location.href = url;

    });

};


// اجرای اولیه
initWhatsappForm();


// پشتیبانی از Astro View Transitions
document.addEventListener(
    "astro:page-load",
    initWhatsappForm
);