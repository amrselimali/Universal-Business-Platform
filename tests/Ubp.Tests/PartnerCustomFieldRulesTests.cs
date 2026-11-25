using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// اختيار حقل «الكود الورقي» من تعريفات الحقول المخصصة للعميل لعرضه في قائمة العملاء
/// في عمود بجوار الكود (المفتاح أو التسمية تحتوي paper/ورق).
/// </summary>
public sealed class PartnerCustomFieldRulesTests
{
    private static CustomFieldDefinition Field(string key, string labelAr, string? labelEn = null) => new()
    {
        EntityName = "customers", FieldKey = key, LabelAr = labelAr, LabelEn = labelEn,
        DataType = "text", IsActive = true
    };

    [Fact]
    public void Paper_code_is_detected_from_the_field_key()
    {
        var paper = Field("paper_code", "كود ورقي");
        var found = PartnerCustomFieldRules.FindPaperCode(new[]
        {
            Field("note", "ملاحظات"), paper, Field("area", "المنطقة")
        });

        Assert.Same(paper, found);
    }

    [Fact]
    public void Paper_code_is_detected_from_the_arabic_or_english_label()
    {
        Assert.NotNull(PartnerCustomFieldRules.FindPaperCode(
            new[] { Field("code2", "الكود الورقى") }));
        Assert.NotNull(PartnerCustomFieldRules.FindPaperCode(
            new[] { Field("code3", "كود", "Paper code") }));
    }

    [Fact]
    public void Unrelated_or_missing_fields_return_null()
    {
        Assert.Null(PartnerCustomFieldRules.FindPaperCode(new[]
        {
            Field("note", "ملاحظات"), Field("area", "المنطقة")
        }));
        Assert.Null(PartnerCustomFieldRules.FindPaperCode(Array.Empty<CustomFieldDefinition>()));
    }
}
