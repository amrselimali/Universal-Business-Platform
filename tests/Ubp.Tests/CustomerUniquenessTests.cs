using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>تكرار الهاتف/الواتساب/الكود الورقي داخل نفس الفرع فقط + تعديل بيانات الاتصال.</summary>
public sealed class CustomerUniquenessTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public CustomerUniquenessTests(TestDb db) => _db = db;

    private async Task<(Guid BranchA, Guid BranchB, PartnerCategory Category)> SetupAsync(
        string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var branchA = await _db.CreateBranchAsync("CU-B-A-" + suffix, "فرع تكرار أ " + suffix);
        var branchB = await _db.CreateBranchAsync("CU-B-B-" + suffix, "فرع تكرار ب " + suffix);
        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "CU-CAT-" + suffix, NameAr = "تصنيف تكرار " + suffix });
        if ((await _db.CustomFieldRepo.ListActiveAsync("customers")).All(f =>
                f.FieldKey != "paper_code"))
            await _db.CustomFieldRepo.CreateAsync(new CustomFieldInput
            {
                EntityName = "customers", FieldKey = "paper_code", LabelAr = "الكود الورقي",
                DataType = "text", IsActive = true, SortOrder = 1
            });
        return (branchA, branchB, category);
    }

    private PartnerInput Input(Guid branch, PartnerCategory category, string name,
        string phone, string whatsapp, string paper) => new()
    {
        NameAr = name, CategoryId = category.Id, ScopeType = "BRANCH", BranchId = branch,
        Phone = phone, WhatsAppPhone = whatsapp,
        CustomFields = new Dictionary<string, object?> { ["paper_code"] = paper }
    };

    [Fact]
    public async Task Phone_whatsapp_and_paper_code_repeat_across_branches_but_not_within_branch()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("1");
        await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            Input(s.BranchA, s.Category, "عميل أ", "01011111111", "01111111111", "P-100"));
        // نفس البيانات في فرع آخر مسموحة.
        await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            Input(s.BranchB, s.Category, "عميل ب", "01011111111", "01111111111", "P-100"));

        var phone = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().CreateAsync(actor, PartnerKind.Customer,
                Input(s.BranchA, s.Category, "عميل تكرار هاتف", "01011111111",
                    "01222222222", "P-101")));
        Assert.Equal("validation.customer_phone_duplicate", phone.Code);
        var whatsapp = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().CreateAsync(actor, PartnerKind.Customer,
                Input(s.BranchA, s.Category, "عميل تكرار واتساب", "01333333333",
                    "01111111111", "P-102")));
        Assert.Equal("validation.customer_whatsapp_duplicate", whatsapp.Code);
        var paper = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().CreateAsync(actor, PartnerKind.Customer,
                Input(s.BranchA, s.Category, "عميل تكرار كود ورقي", "01444444444",
                    "01555555555", "P-100")));
        Assert.Equal("validation.customer_paper_code_duplicate", paper.Code);
    }

    [Fact]
    public async Task Contact_only_update_changes_phone_and_whatsapp_and_keeps_branch_rules()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("2");
        var first = await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            Input(s.BranchA, s.Category, "عميل اتصال", "01666666666", "01777777777", "C-1"));
        var second = await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            Input(s.BranchA, s.Category, "عميل ثان", "01888888888", "01999999999", "C-2"));

        var duplicate = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateContactAsync(actor, first.Id, first.Version,
                "01888888888", "01010101010"));
        Assert.Equal("validation.customer_phone_duplicate", duplicate.Code);
        var updated = await _db.Partners().UpdateContactAsync(actor, first.Id, first.Version,
            "01020202020", "01030303030");
        Assert.Equal("01020202020", updated.Phone);
        Assert.Equal("01030303030", updated.WhatsAppPhone);
        Assert.Equal(second.NameAr, (await _db.PartnerRepo.GetAsync(PartnerKind.Customer,
            second.Id))!.NameAr);
    }
}
