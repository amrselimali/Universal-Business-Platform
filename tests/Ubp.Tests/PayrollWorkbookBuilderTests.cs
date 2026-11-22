using System.Globalization;
using Ubp.Application.Services;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات مصنّف Excel (SpreadsheetML): أوراق متعددة، تهريب XML، وأرقام ثابتة اللغوية.</summary>
public sealed class PayrollWorkbookBuilderTests
{
    private static PayrollSheet RegisterSheet() => new("Register",
        new[] { "Code", "Employee", "Base" },
        new List<IReadOnlyList<object?>>
        {
            new object?[] { "E-01", "أحمد & <علي>", 1234.5m },
            new object?[] { "E-02", "O'Brien \"quoted\"", null }
        });

    [Fact]
    public void WorkbookContainsOneWorksheetPerSheet()
    {
        var xml = PayrollWorkbookBuilder.BuildWorkbookXml(new[]
        {
            RegisterSheet(), new PayrollSheet("Summary", new[] { "Key" }, Array.Empty<IReadOnlyList<object?>>())
        });

        Assert.Equal(2, CountOccurrences(xml, "<Worksheet "));
        Assert.Contains("ss:Name=\"Register\"", xml);
        Assert.Contains("ss:Name=\"Summary\"", xml);
        Assert.Contains("urn:schemas-microsoft-com:office:spreadsheet", xml);
    }

    [Fact]
    public void XmlSpecialCharactersAreEscaped()
    {
        var xml = PayrollWorkbookBuilder.BuildWorkbookXml(new[] { RegisterSheet() });

        Assert.Contains("أحمد &amp; &lt;علي&gt;", xml);
        Assert.Contains("O&apos;Brien &quot;quoted&quot;", xml);
        Assert.DoesNotContain("<علي>", xml);
    }

    [Fact]
    public void DecimalValuesStayInvariantUnderArabicCulture()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("de-DE");
            var xml = PayrollWorkbookBuilder.BuildWorkbookXml(new[] { RegisterSheet() });

            Assert.Contains("ss:Type=\"Number\">1234.5<", xml);
            Assert.DoesNotContain("1234,5", xml);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void NullCellsAreEmittedEmpty()
    {
        var xml = PayrollWorkbookBuilder.BuildWorkbookXml(new[] { RegisterSheet() });

        Assert.Contains("<Cell/>", xml);
    }

    [Fact]
    public void SheetNamesAreSanitizedTruncatedAndUnique()
    {
        Assert.Equal("AB", PayrollWorkbookBuilder.SanitizeName("A:B"));
        Assert.Equal(31, PayrollWorkbookBuilder.SanitizeName(new string('X', 40)).Length);
        Assert.Equal("Sheet", PayrollWorkbookBuilder.SanitizeName("   "));

        var xml = PayrollWorkbookBuilder.BuildWorkbookXml(new[]
        {
            new PayrollSheet("Same", Array.Empty<string>(), Array.Empty<IReadOnlyList<object?>>()),
            new PayrollSheet("Same", Array.Empty<string>(), Array.Empty<IReadOnlyList<object?>>())
        });

        Assert.Contains("ss:Name=\"Same\"", xml);
        Assert.Contains("ss:Name=\"Same_2\"", xml);
    }

    [Fact]
    public void CsvQuotesSeparatorsAndQuotes()
    {
        var csv = PayrollWorkbookBuilder.BuildCsv(new PayrollSheet("T",
            new[] { "Code", "Value" },
            new List<IReadOnlyList<object?>>
            {
                new object?[] { "A,B", "say \"hi\"" },
                new object?[] { "E-01", 12.5m }
            }));

        Assert.Contains("\"A,B\"", csv);
        Assert.Contains("\"say \"\"hi\"\"\"", csv);
        Assert.Contains("E-01,12.5", csv);
    }

    private static int CountOccurrences(string text, string token)
    {
        var count = 0;
        var index = 0;
        while ((index = text.IndexOf(token, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += token.Length;
        }
        return count;
    }
}
