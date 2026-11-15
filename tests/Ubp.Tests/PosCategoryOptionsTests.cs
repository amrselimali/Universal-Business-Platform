using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// نقطة البيع تعرض تصنيفات الأصناف من شاشة التصنيفات كاملة، وتفلتر أصناف التصنيف
/// المحدد من الخادم. سابقاً كانت تستخلص التصنيفات من الأصناف المحمَّلة فقط، وكان
/// مستودع الأصناف يقصّ أي دفعة أكبر من 50 إلى 25 صنفاً — فتختفي معظم التصنيفات.
/// </summary>
public sealed class PosCategoryOptionsTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public PosCategoryOptionsTests(TestDb db) => _db = db;

    private static string Unique() => Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    [Fact]
    public async Task All_active_categories_are_listed_even_without_items()
    {
        var suffix = Unique();
        var empty = await _db.ItemCategoryRepo.CreateAsync(new ItemCategoryInput
        {
            Code = "PCE-" + suffix, NameAr = "تصنيف بلا أصناف " + suffix
        });

        var categories = await _db.ItemCategoryRepo.ListOptionsAsync();

        Assert.Contains(categories, c => c.Id == empty.Id);
        Assert.Contains(categories, c => c.NameAr == "تصنيف بلا أصناف " + suffix);
    }

    [Fact]
    public async Task Large_batch_is_not_clamped_and_category_filter_narrows_results()
    {
        var suffix = Unique();
        var categoryA = await _db.ItemCategoryRepo.CreateAsync(new ItemCategoryInput
        {
            Code = "PCA-" + suffix, NameAr = "تصنيف أ " + suffix
        });
        var categoryB = await _db.ItemCategoryRepo.CreateAsync(new ItemCategoryInput
        {
            Code = "PCB-" + suffix, NameAr = "تصنيف ب " + suffix
        });
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        {
            Code = "U" + suffix[..6], NameAr = "وحدة " + suffix
        });

        async Task<Guid> CreateItemAsync(string code, Guid categoryId) =>
            (await _db.ItemRepo.CreateAsync(new ItemInput
            {
                Code = code, NameAr = code, CategoryId = categoryId, BaseUnitId = unit.Id,
                Units = new List<ItemUnitInput>
                {
                    new() { UnitId = unit.Id, ConversionFactor = 1 }
                }
            })).Id;

        // 30 صنفاً في التصنيف أ (أكثر من حد 25 القديم) وصنف واحد في التصنيف ب.
        for (var i = 0; i < 30; i++)
            await CreateItemAsync($"POS-{suffix}-A{i}", categoryA.Id);
        var itemB = await CreateItemAsync($"POS-{suffix}-B", categoryB.Id);

        // دفعة نقطة البيع (500) لا تُقصّ بعد الآن إلى 25.
        var all = await _db.ItemRepo.ListOptionsAsync(null, 500, true);
        Assert.True(all.Count(i => i.CategoryId == categoryA.Id) >= 30,
            "دفعة الأصناف الكبيرة قُصّت: المتوقع 30 صنفاً على الأقل من التصنيف أ.");

        // فلتر التصنيف يعيد أصناف التصنيف المحدد فقط.
        var onlyA = await _db.ItemRepo.ListOptionsAsync(null, 500, true, categoryA.Id);
        Assert.Equal(30, onlyA.Count);
        Assert.All(onlyA, i => Assert.Equal(categoryA.Id, i.CategoryId));

        var onlyB = await _db.ItemRepo.ListOptionsAsync(null, 500, true, categoryB.Id);
        Assert.Single(onlyB);
        Assert.Equal(itemB, onlyB[0].Id);
    }
}
