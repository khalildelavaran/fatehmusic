/* ==========================================================
   Motion Engine v1.0
   Fateh Music Academy

   Stable Public API

   Supported Attributes

   data-reveal
   data-reveal-group
   data-reveal-delay

   data-counter

   (Future)
   data-parallax
   data-tilt
   data-magnetic
========================================================== */

(() => {

"use strict";
if (

    typeof window === "undefined"

) {

    return;

}
/* ==========================================================
   Configuration
========================================================== */

const CONFIG = {

    observer: {

        threshold: 0.18,

        rootMargin: "0px 0px -8% 0px"

    },

    reveal: {

        delayUnit: 100,

        stagger: 90

    },

    counter: {

        duration: 1800

    }

};

/* ==========================================================
   Utilities
========================================================== */

const Utils = {

    easeOutCubic(t) {

        return 1 - Math.pow(1 - t, 3);

    },

    parseCounter(text) {

        const value = parseFloat(

            text.replace(/[^\d.]/g, "")

        );

        const prefix =

            text.match(/^[^\d]+/)?.[0] ?? "";

        const suffix =

            text.match(/[^\d.]+$/)?.[0] ?? "";

        const decimals =

            text.includes(".")

                ? text

                    .split(".")[1]

                    .replace(/\D/g, "")

                    .length

                : 0;

        return {

            value,

            prefix,

            suffix,

            decimals

        };

    },

    formatCounter(

        value,

        decimals,

        prefix,

        suffix

    ) {

        return (

            prefix +

            value.toFixed(decimals) +

            suffix

        );

    }

};

/* ==========================================================
   Motion Engine
========================================================== */

const Motion = {

    initialized: false,

    observer: null,

    observed: new WeakSet(),

    handlers: Object.create(null)

};

/* ==========================================================
   Public API
========================================================== */

Motion.register = (

    name,

    handler

) => {

    if (

        Motion.handlers[name]

    ) {

        console.warn(

            `[Motion] "${name}" already registered.`

        );

        return;

    }

    Motion.handlers[name] = handler;

};

Motion.refresh = () => {

    Motion.observed = new WeakSet();

    scan();

};

Motion.destroy = () => {

    Motion.observer?.disconnect();

    Motion.observed = new WeakSet();

};

window.Motion = Motion;

/* ==========================================================
   Safe Execute
========================================================== */

const execute = (

    name,

    element

) => {

    const handler = Motion.handlers[name];

    if (

        !handler

    ) return;

    try {

        handler(

            element

        );

    }

    catch (error) {

        console.error(

            `[Motion:${name}]`,

            error

        );

    }

};

/* ==========================================================
   Scan DOM
========================================================== */

const scan = () => {

    const elements = document.querySelectorAll(

        [

            "[data-reveal]",

            "[data-counter]",

            "[data-parallax]",

            "[data-tilt]",

            "[data-magnetic]"

        ].join(",")

    );

    elements.forEach(

        (element) => {

            if (

                Motion.observed.has(

                    element

                )

            ) return;

            Motion.observed.add(

                element

            );

            Motion.observer.observe(

                element

            );

        }

    );

};

/* ==========================================================
   Dispatcher
========================================================== */

const dispatch = (

    element

) => {

    element.dispatchEvent(

        new CustomEvent(

            "motion:start",

            {

                bubbles: true

            }

        )

    );

    if (

        element.hasAttribute(

            "data-reveal"

        )

    ) {

        execute(

            "reveal",

            element

        );

    }

    if (

        element.hasAttribute(

            "data-counter"

        )

    ) {

        execute(

            "counter",

            element

        );

    }

    if (

        element.hasAttribute(

            "data-parallax"

        )

    ) {

        execute(

            "parallax",

            element

        );

    }

    if (

        element.hasAttribute(

            "data-tilt"

        )

    ) {

        execute(

            "tilt",

            element

        );

    }

    if (

        element.hasAttribute(

            "data-magnetic"

        )

    ) {

        execute(

            "magnetic",

            element

        );

    }

    element.dispatchEvent(

        new CustomEvent(

            "motion:end",

            {

                bubbles: true

            }

        )

    );

};
/* ==========================================================
   Global Observer
========================================================== */

Motion.observer = new IntersectionObserver(

    (entries) => {

        entries.forEach((entry) => {

            if (!entry.isIntersecting) return;

            dispatch(entry.target);

            Motion.observer.unobserve(entry.target);

        });

    },

    {

        root: null,

        threshold: CONFIG.observer.threshold,

        rootMargin: CONFIG.observer.rootMargin

    }

);

/* ==========================================================
   Reveal Handler
========================================================== */

Motion.register(

    "reveal",

    (element) => {

        if (

            element.classList.contains(

                "is-visible"

            )

        ) {

            return;

        }

        const delay = Number(

            element.dataset.revealDelay || 0

        );

        setTimeout(

            () => {

                element.classList.add(

                    "is-visible"

                );

            },

            delay *

            CONFIG.reveal.delayUnit

        );

        /* ---------------------------------------------
           Stagger Children
        --------------------------------------------- */

        if (

            !element.hasAttribute(

                "data-reveal-group"

            )

        ) {

            return;

        }

        const items = element.querySelectorAll(

            "[data-reveal]"

        );

        items.forEach(

            (child, index) => {

                setTimeout(

                    () => {

                        child.classList.add(

                            "is-visible"

                        );

                    },

                    index *

                    CONFIG.reveal.stagger

                );

            }

        );

    }

);

/* ==========================================================
   Counter Handler
========================================================== */

Motion.register(

    "counter",

    (element) => {

        if (

            element.classList.contains(

                "counter-done"

            )

        ) {

            return;

        }

        element.classList.add(

            "counter-done"

        );

        element.classList.add(

            "is-running"

        );

        const counter =

            Utils.parseCounter(

                element.textContent.trim()

            );

        const duration =

            Number(

                element.dataset.duration

            ) ||

            CONFIG.counter.duration;

        const start = performance.now();

        const animate = (now) => {

            const progress = Math.min(

                (now - start) /

                duration,

                1

            );

            const value =

                counter.value *

                Utils.easeOutCubic(

                    progress

                );

            element.textContent =

                Utils.formatCounter(

                    value,

                    counter.decimals,

                    counter.prefix,

                    counter.suffix

                );

            if (

                progress < 1

            ) {

                requestAnimationFrame(

                    animate

                );

                return;

            }

            element.textContent =

                Utils.formatCounter(

                    counter.value,

                    counter.decimals,

                    counter.prefix,

                    counter.suffix

                );

            element.classList.remove(

                "is-running"

            );

            element.classList.add(

                "is-finished"

            );

        };

        requestAnimationFrame(

            animate

        );

    }

);
/* ==========================================================
   Boot
========================================================== */

const boot = () => {

    if (

        Motion.initialized

    ) {

        return;

    }

    Motion.initialized = true;

    scan();

};

/* ==========================================================
   DOM Ready
========================================================== */

if (

    document.readyState === "loading"

) {

    document.addEventListener(

        "DOMContentLoaded",

        boot,

        {

            once: true

        }

    );

}

else {

    boot();

}

/* ==========================================================
   Astro View Transition Support
========================================================== */

document.addEventListener(

    "astro:page-load",

    () => {

        Motion.observed = new WeakSet();

        scan();

    }

);

/* ==========================================================
   Future Plugins
========================================================== */

Motion.register(

    "parallax",

    () => {

        /* Reserved */

    }

);

Motion.register(

    "tilt",

    () => {

        /* Reserved */

    }

);

Motion.register(

    "magnetic",

    () => {

        /* Reserved */

    }

);

/* ==========================================================
   Freeze Notice

   Motion Engine v1.0

   Stable Public API

   Public Attributes

       data-reveal
       data-reveal-group
       data-reveal-delay

       data-counter

       data-parallax
       data-tilt
       data-magnetic

   Public Methods

       Motion.register()
       Motion.refresh()
       Motion.destroy()

   Architecture

       CONFIG
       ↓
       Utils
       ↓
       Registry
       ↓
       Dispatcher
       ↓
       Observer
       ↓
       Handlers

   Version 1.0 Freeze

========================================================== */

})();