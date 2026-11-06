using Zamzam.Domain.Entities;
using Zamzam.Domain.Settings;

namespace Zamzam.Infrastructure.Persistence.Seed;

// Starting data for a new database. Fees and prices are placeholders the owner edits in the dashboard.
internal static class SeedData
{
    // 27 governorates. Fee / delivery days are starting values to confirm with the client.
    public static IEnumerable<DeliveryZone> DeliveryZones()
    {
        (string Key, string Ar, string En, decimal Fee, int Min, int Max)[] zones =
        [
            ("cairo", "القاهرة", "Cairo", 65, 1, 3),
            ("giza", "الجيزة", "Giza", 65, 1, 3),
            ("alexandria", "الإسكندرية", "Alexandria", 75, 2, 4),
            ("qalyubia", "القليوبية", "Qalyubia", 70, 2, 4),
            ("port-said", "بورسعيد", "Port Said", 80, 2, 4),
            ("suez", "السويس", "Suez", 80, 2, 4),
            ("ismailia", "الإسماعيلية", "Ismailia", 80, 2, 4),
            ("damietta", "دمياط", "Damietta", 80, 2, 4),
            ("dakahlia", "الدقهلية", "Dakahlia", 80, 2, 4),
            ("sharqia", "الشرقية", "Sharqia", 80, 2, 4),
            ("gharbia", "الغربية", "Gharbia", 80, 2, 4),
            ("monufia", "المنوفية", "Monufia", 80, 2, 4),
            ("kafr-el-sheikh", "كفر الشيخ", "Kafr El Sheikh", 80, 2, 4),
            ("beheira", "البحيرة", "Beheira", 80, 2, 4),
            ("faiyum", "الفيوم", "Faiyum", 90, 3, 5),
            ("beni-suef", "بني سويف", "Beni Suef", 90, 3, 5),
            ("minya", "المنيا", "Minya", 95, 3, 5),
            ("asyut", "أسيوط", "Asyut", 100, 3, 6),
            ("sohag", "سوهاج", "Sohag", 100, 3, 6),
            ("qena", "قنا", "Qena", 100, 3, 6),
            ("luxor", "الأقصر", "Luxor", 100, 3, 6),
            ("aswan", "أسوان", "Aswan", 110, 4, 7),
            ("red-sea", "البحر الأحمر", "Red Sea", 120, 4, 7),
            ("new-valley", "الوادي الجديد", "New Valley", 120, 4, 7),
            ("matrouh", "مطروح", "Matrouh", 120, 4, 7),
            ("north-sinai", "شمال سيناء", "North Sinai", 120, 4, 7),
            ("south-sinai", "جنوب سيناء", "South Sinai", 120, 4, 7),
        ];
        return zones.Select(z => new DeliveryZone(z.Key, z.Ar, z.En, z.Fee, z.Min, z.Max));
    }

    // The 10 colors from the old demo.
    public static IEnumerable<Color> Colors() =>
    [
        new("أسود", "Black", "#161616"),
        new("أبيض", "White", "#f7f5ed"),
        new("بيج", "Beige", "#d6b995"),
        new("كحلي", "Navy", "#19344a"),
        new("بني", "Brown", "#815332"),
        new("وردي", "Pink", "#d9a5ad"),
        new("زيتي", "Olive", "#727c54"),
        new("رمادي", "Gray", "#909397"),
        new("كريمي", "Cream", "#e9dac3"),
        new("أوف وايت", "Off-white", "#eee7d9"),
    ];

    // The tailoring studio from the old demo: 6 garment types, 12 styles, measurement groups.
    public static TailoringCatalogContent TailoringCatalog()
    {
        static MeasurementField F(string key, string ar, string en) => new(key, ar, en);

        var groups = new Dictionary<string, IReadOnlyList<MeasurementField>>
        {
            ["common"] =
            [
                F("height", "الطول الكلي للجسم", "Body height"), F("neck", "محيط الرقبة", "Neck circumference"),
                F("shoulders", "عرض الكتفين", "Shoulder width"), F("bust", "محيط الصدر", "Bust circumference"),
                F("underBust", "محيط أسفل الصدر", "Underbust"), F("waist", "محيط الوسط", "Waist circumference"),
                F("highHip", "محيط أعلى الأرداف", "High hip"), F("hips", "محيط الأرداف", "Hip circumference"),
                F("backWidth", "عرض الظهر", "Back width"), F("frontWidth", "عرض الصدر الأمامي", "Front chest width"),
                F("shoulderToWaist", "من الكتف إلى الوسط", "Shoulder to waist"), F("backWaist", "طول الظهر للوسط", "Back waist length"),
            ],
            ["sleeves"] =
            [
                F("armhole", "محيط حردة الإبط", "Armhole"), F("upperArm", "محيط العضد", "Upper arm"),
                F("elbow", "محيط الكوع", "Elbow circumference"), F("wrist", "محيط المعصم", "Wrist circumference"),
                F("sleeve", "طول الكم", "Sleeve length"), F("shoulderToElbow", "من الكتف للكوع", "Shoulder to elbow"),
                F("cuff", "عرض الإسورة", "Cuff width"),
            ],
            ["pants"] =
            [
                F("thigh", "محيط الفخذ", "Thigh"), F("knee", "محيط الركبة", "Knee"), F("calf", "محيط السمانة", "Calf"),
                F("ankle", "محيط الكاحل", "Ankle"), F("legOpening", "اتساع فتحة الرجل", "Leg opening"),
                F("inseam", "طول الرجل الداخلي", "Inseam"), F("outseam", "طول الرجل الخارجي", "Outseam"),
                F("frontRise", "ارتفاع الحجر الأمامي", "Front rise"), F("backRise", "ارتفاع الحجر الخلفي", "Back rise"),
                F("seatDepth", "عمق القعدة", "Crotch depth"),
            ],
            ["tops"] =
            [
                F("topLength", "طول البلوزة", "Top length"), F("hemWidth", "اتساع الذيل", "Hem width"),
                F("neckDepth", "عمق فتحة الرقبة", "Neckline depth"), F("shoulderSlope", "ميل الكتف", "Shoulder slope"),
            ],
            ["dress"] =
            [
                F("dressLength", "طول الفستان / العباية", "Dress / abaya length"), F("waistToHem", "من الوسط للذيل", "Waist to hem"),
                F("hemWidth", "اتساع الذيل", "Hem width"), F("neckDepth", "عمق فتحة الرقبة", "Neckline depth"),
                F("sideSlit", "ارتفاع الشق الجانبي", "Side slit height"),
            ],
            ["skirt"] =
            [
                F("skirtLength", "طول الجيبة", "Skirt length"), F("waistToHip", "من الوسط للأرداف", "Waist to hip"),
                F("hemWidth", "اتساع الذيل", "Hem width"), F("slitHeight", "ارتفاع الشق", "Slit height"),
            ],
            ["outer"] =
            [
                F("outerLength", "طول الجاكيت / الكيمونو", "Outerwear length"), F("lapelWidth", "عرض الياقة", "Lapel width"),
                F("hemWidth", "اتساع الذيل", "Hem width"),
            ],
            ["set"] =
            [
                F("topLength", "طول القطعة العلوية", "Top length"), F("bottomLength", "طول القطعة السفلية", "Bottom length"),
                F("inseam", "طول الرجل الداخلي (لو بنطلون)", "Inseam (trousers)"), F("skirtLength", "طول الجيبة (لو جيبة)", "Skirt length"),
                F("hemWidth", "اتساع الذيل", "Hem width"),
            ],
        };

        return new TailoringCatalogContent(
            Garments:
            [
                new("pants", "بناطيل", "Trousers", ["common", "pants"]),
                new("tops", "بلوزات وتونيكات", "Blouses & tunics", ["common", "sleeves", "tops"]),
                new("dress", "فساتين وعبايات", "Dresses & abayas", ["common", "sleeves", "dress"]),
                new("skirt", "جيبات", "Skirts", ["common", "skirt"]),
                new("outer", "جاكيتات وكيمونو", "Jackets & kimonos", ["common", "sleeves", "outer"]),
                new("set", "أطقم", "Co-ord sets", ["common", "sleeves", "set"]),
            ],
            Styles:
            [
                new("wide_pants", "pants", "بنطلون وايد ليج", "Wide-leg trousers", "linen", "Relaxed"),
                new("palazzo", "pants", "بنطلون بالازو", "Palazzo trousers", "crepe", "Oversized"),
                new("long_blouse", "tops", "بلوزة طويلة بأكمام", "Longline blouse", "cotton", "Relaxed"),
                new("bow_blouse", "tops", "بلوزة بربطة رقبة", "Tie-neck blouse", "crepe", "Regular"),
                new("blazer", "outer", "بليزر طويل", "Longline blazer", "linen", "Regular"),
                new("kimono", "outer", "كيمونو مفتوح طويل", "Long open kimono", "crepe", "Oversized"),
                new("maxi", "dress", "فستان ماكسي واسع", "Flowing maxi dress", "crepe", "Relaxed"),
                new("abaya", "dress", "عباية بحزام", "Belted abaya", "crepe", "Relaxed"),
                new("pleated_skirt", "skirt", "جيبة ماكسي بليسيه", "Pleated maxi skirt", "crepe", "Relaxed"),
                new("aline_skirt", "skirt", "جيبة A-Line", "A-line maxi skirt", "linen", "Regular"),
                new("coord", "set", "طقم بلوزة وبنطلون", "Blouse & trousers co-ord", "linen", "Relaxed"),
                new("tunic_set", "set", "طقم تونيك وجيبة", "Tunic & skirt set", "cotton", "Relaxed"),
            ],
            Fabrics:
            [
                new("cotton", "قطن", "Cotton"), new("linen", "كتان", "Linen"), new("denim", "جينز", "Denim"),
                new("crepe", "كريب", "Crepe"), new("satin", "ستان", "Satin"), new("chiffon", "شيفون ببطانة", "Lined chiffon"),
                new("wool", "صوف", "Wool"), new("other", "حسب الاتفاق", "To be discussed"),
            ],
            Fits:
            [
                new("Regular", "عادي", "Regular"), new("Relaxed", "واسع", "Relaxed"),
                new("Oversized", "أوفر سايز", "Oversized"), new("Slim", "ضيق", "Slim"),
            ],
            MeasurementGroups: groups);
    }

    // Starting prices (EGP) so the calculator works on day one. The owner sets the real ones.
    public static PriceRulesContent PriceRules() => new(
        GarmentBasePrices:
        [
            new("pants", 900), new("tops", 750), new("dress", 1400),
            new("skirt", 800), new("outer", 1300), new("set", 1600),
        ],
        StyleBasePrices:
        [
            new("wide_pants", 900), new("palazzo", 950), new("long_blouse", 750), new("bow_blouse", 800),
            new("blazer", 1400), new("kimono", 1200), new("maxi", 1350), new("abaya", 1400),
            new("pleated_skirt", 850), new("aline_skirt", 800), new("coord", 1600), new("tunic_set", 1550),
        ],
        Fabrics:
        [
            new("cotton", 0), new("linen", 100), new("denim", 100), new("crepe", 150),
            new("satin", 200), new("chiffon", 250), new("wool", 300), new("other", 0),
        ],
        LiningPrice: 150,
        SizeExtras: [new("XXL", 100), new("3XL", 150)],
        Extras:
        [
            new("embroidery", "تطريز", "Embroidery", 300),
            new("pockets", "جيوب", "Pockets", 50),
            new("belt", "حزام", "Belt", 80),
        ]);
}
