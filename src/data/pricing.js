/**
 * ============================================================
 * Fateh Music Academy
 * pricing.js
 * Enterprise Edition v1.0
 *
 * Single Source of Truth
 * ============================================================
 */


export const pricing = {


/* ============================================================
   تعرفه‌ها
============================================================ */

plans: {


    standard: {

        title:
        "سازهای موسیقی",

        duration:

        {
            sessions: 8,

            period:
            "دو ماه"
        },


        paymentOptions: {


            fullTerm: {

                title:
                "پرداخت کامل ترم",

                amount:
                3200000

            },


            halfTerm: {

                title:
                "پرداخت نیم‌ترم (ماهیانه)",

                amount:
                1600000

            }

        }

    },



    keyboard: {


        title:
        "سازهای کلاویه‌ای",


        duration:

        {
            sessions: 10,

            period:
            "دو ماه و نیم"
        },


        paymentOptions: {


            fullTerm: {

                title:
                "پرداخت کامل ترم",

                amount:
                4000000

            },


            halfTerm: {


                title:
                "پرداخت نیم‌ترم",

                amount:
                2000000

            }

        }

    }


},



/* ============================================================
   ارتباط دوره‌ها با تعرفه
============================================================ */


coursePricingMap: {


    "guitar-course":
    "standard",


    "violin-course":
    "standard",


    "kamancheh-course":
    "standard",


    "tar-course":
    "standard",


    "setar-course":
    "standard",


    "santur-course":
    "standard",


    "daf-course":
    "standard",


    "tonbak-course":
    "standard",


    "zarb-tempo-course":
    "standard",


    "ney-anban-course":
    "standard",


    "ney-course":
    "standard",


    "children-music-course":
    "standard",


    "hangdrum-course":
    "standard",


    "traditional-vocal-course":
    "standard",


    "bakhtiari-vocal-course":
    "standard",


    "pop-vocal-course":
    "standard",


    "shushtari-vocal-course":
    "standard",


    "solfege-course":
    "standard",


    "rhythm-reading-course":
    "standard",


    "music-theory-course":
    "standard",


    "voice-training-course":
    "standard",


    "piano-course":
    "keyboard",


    "keyboard-course":
    "keyboard"


}

};