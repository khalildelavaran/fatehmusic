/* ==========================================================
   Reveal Animation Engine
   Fateh Music Academy
========================================================== */

(() => {

    "use strict";

    let observer = null;

    const revealed = new WeakSet();

    /* ======================================================
       Reveal Element
    ====================================================== */

    const revealElement = (element) => {

        if (revealed.has(element)) return;

        revealed.add(element);

        element.classList.add("revealed");

        observer?.unobserve(element);

    };

    /* ======================================================
       Reveal Group
    ====================================================== */

    const revealGroup = (group) => {

        if (revealed.has(group)) return;

        revealed.add(group);

        group.classList.add("revealed");

        observer?.unobserve(group);

    };

    /* ======================================================
       Observe Callback
    ====================================================== */

    const onIntersect = (entries) => {

        entries.forEach((entry) => {

            if (!entry.isIntersecting) return;

            const element = entry.target;

            if (

                element.hasAttribute(

                    "data-reveal-group"

                )

            ) {

                revealGroup(element);

            }

            else {

                revealElement(element);

            }

        });

    };

    /* ======================================================
       Create Observer
    ====================================================== */

    const createObserver = () => {

        if (observer) {

            observer.disconnect();

        }

        observer = new IntersectionObserver(

            onIntersect,

            {

                root: null,

                rootMargin: "0px 0px -12% 0px",

                threshold: 0.12

            }

        );

    };
/* ==========================================================
   Scan Page
========================================================== */

const scan = () => {

    document

        .querySelectorAll(

            "[data-reveal],[data-reveal-group]"

        )

        .forEach((element) => {

            if (

                revealed.has(element)

            ) return;

            observer.observe(element);

        });

};

/* ==========================================================
   Initialize
========================================================== */

const initReveal = () => {

    document.documentElement.classList.add(

        "reveal-ready"

    );

    createObserver();

    scan();

};

/* ==========================================================
   Mutation Observer
========================================================== */

const mutation = new MutationObserver(

    (mutations) => {

        for (const mutation of mutations) {

            mutation.addedNodes.forEach(

                (node) => {

                    if (

                        node.nodeType !== 1

                    ) return;

                    if (

                        node.matches?.(

                            "[data-reveal],[data-reveal-group]"

                        )

                    ) {

                        observer.observe(node);

                    }

                    node

                        .querySelectorAll?.(

                            "[data-reveal],[data-reveal-group]"

                        )

                        .forEach(

                            (element) => {

                                observer.observe(element);

                            }

                        );

                }

            );

        }

    }

);

mutation.observe(

    document.body,

    {

        childList:true,

        subtree:true

    }

);
/* ==========================================================
   CLEANUP
========================================================== */

const destroyReveal = () => {

    if (observer) {

        observer.disconnect();

        observer = null;

    }

};

/* ==========================================================
   DOM READY
========================================================== */

if (

    document.readyState === "loading"

) {

    document.addEventListener(

        "DOMContentLoaded",

        initReveal,

        {

            once:true

        }

    );

}

else {

    initReveal();

}

/* ==========================================================
   ASTRO VIEW TRANSITIONS
========================================================== */

document.addEventListener(

    "astro:page-load",

    () => {

        requestAnimationFrame(

            () => {

                destroyReveal();

                initReveal();

            }

        );

    }

);

/* ==========================================================
   PAGE HIDE
========================================================== */

window.addEventListener(

    "pagehide",

    destroyReveal

);

/* ==========================================================
   EXPORT (Debug)
========================================================== */

window.RevealEngine = {

    refresh(){

        destroyReveal();

        initReveal();

    },

    destroy(){

        destroyReveal();

    }

};

})();