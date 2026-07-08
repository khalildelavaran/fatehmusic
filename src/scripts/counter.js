/* ==========================================================
   Counter Engine
   Fateh Music Academy
========================================================== */

(() => {

    "use strict";

    const animated = new WeakSet();

    /* ======================================================
       Helpers
    ====================================================== */

    const easeOutCubic = (t) => {

        return 1 - Math.pow(1 - t, 3);

    };

    const parseValue = (text) => {

        const number = parseFloat(

            text.replace(/[^\d.]/g, "")

        );

        const prefix = text.match(/^[^\d]+/)?.[0] ?? "";

        const suffix = text.match(/[^\d.]+$/)?.[0] ?? "";

        const decimals = (

            text.split(".")[1]?.replace(/\D/g, "")

            .length

        ) || 0;

        return {

            value: number,

            prefix,

            suffix,

            decimals

        };

    };

    const formatValue = (

        value,

        decimals,

        prefix,

        suffix

    ) => {

        return (

            prefix +

            value.toFixed(decimals) +

            suffix

        );

    };
    /* ======================================================
       Animation
    ====================================================== */

    const animateCounter = (

        element

    ) => {

        if (

            animated.has(element)

        ) return;

        animated.add(element);

        const target = parseValue(

            element.textContent.trim()

        );

        const duration = Number(

            element.dataset.duration

        ) || 1800;

        const start = performance.now();

        const step = (now) => {

            const progress = Math.min(

                (now - start) / duration,

                1

            );

            const eased = easeOutCubic(

                progress

            );

            const current =

                target.value * eased;

            element.textContent =

                formatValue(

                    current,

                    target.decimals,

                    target.prefix,

                    target.suffix

                );

            if (

                progress < 1

            ) {

                requestAnimationFrame(

                    step

                );

            }

            else {

                element.textContent =

                    formatValue(

                        target.value,

                        target.decimals,

                        target.prefix,

                        target.suffix

                    );

                element.classList.add(

                    "counter-finished"

                );

            }

        };

        requestAnimationFrame(

            step

        );

    };
    /* ======================================================
       Initialize
    ====================================================== */

    const initCounters = () => {

        document

            .querySelectorAll("[data-counter]")

            .forEach((element) => {

                if (

                    animated.has(element)

                ) return;

                observer.observe(element);

            });

    };

    /* ======================================================
       Observer
    ====================================================== */

    const observer = new IntersectionObserver(

        (entries) => {

            entries.forEach((entry) => {

                if (

                    !entry.isIntersecting

                ) return;

                animateCounter(

                    entry.target

                );

                observer.unobserve(

                    entry.target

                );

            });

        },

        {

            root:null,

            threshold:.35,

            rootMargin:"0px 0px -10% 0px"

        }

    );

    /* ======================================================
       DOM Ready
    ====================================================== */

    const boot = () => {

        initCounters();

    };

    if (

        document.readyState === "loading"

    ) {

        document.addEventListener(

            "DOMContentLoaded",

            boot,

            {

                once:true

            }

        );

    }

    else {

        boot();

    }

    /* ======================================================
       Astro View Transition Support
    ====================================================== */

    document.addEventListener(

        "astro:page-load",

        boot

    );

})();