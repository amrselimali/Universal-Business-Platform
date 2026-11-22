using System.Diagnostics;
using Ubp.Application.Services;
using Xunit;
using Xunit.Abstractions;

namespace Ubp.Tests;

/// <summary>
/// محاكاة حمل بلا قاعدة بيانات: 50 مستخدمًا متوازياً على محركات حساب نقية،
/// ومليون صف توزيع للتأكد من عدم فقد/خلق أي مبلغ تحت الضغط.
/// </summary>
public sealed class PayrollLoadSimulationTests
{
    private const int Users = 50;
    private const int EmployeesPerUser = 20;
    private readonly ITestOutputHelper _output;

    public PayrollLoadSimulationTests(ITestOutputHelper output) => _output = output;

    [Fact]
    public void FiftyUsersCalculatingInParallelGetIdenticalResults()
    {
        var engines = new PayrollCalculationEngines();
        var brackets = new List<(decimal UpperLimit, decimal Rate)>
        {
            (30000m, 0m), (45000m, 0.10m), (60000m, 0.15m), (decimal.MaxValue, 0.20m)
        };

        decimal Expected(int index)
        {
            var taxable = 8000m + index * 1500m;
            var tax = engines.CalculateCumulativeTax(taxable, 0m, 0m, brackets);
            var insurance = engines.CalculateInsurance(taxable, 0.11m, 0.19m, 4000m, 9000m);
            return decimal.Round(tax.CurrentDue + insurance.EmployeeShare, 2);
        }

        var reference = Enumerable.Range(0, EmployeesPerUser).Select(Expected).ToArray();
        var failures = 0;
        var stopwatch = Stopwatch.StartNew();

        Parallel.For(0, Users, user =>
        {
            for (var employee = 0; employee < EmployeesPerUser; employee++)
            {
                if (Expected(employee) != reference[employee]) Interlocked.Increment(ref failures);
            }
        });

        stopwatch.Stop();
        _output.WriteLine($"users={Users}, calculations={Users * EmployeesPerUser}, elapsed={stopwatch.ElapsedMilliseconds} ms");

        Assert.Equal(0, failures);
        Assert.Equal(reference[0], Expected(0));
        Assert.True(stopwatch.Elapsed < TimeSpan.FromMinutes(2),
            $"Simulation took too long: {stopwatch.Elapsed}");
    }

    [Fact]
    public void OneMillionAllocationRowsKeepTotalsExact()
    {
        var ratios = new[] { 0.4m, 0.35m, 0.25m };
        const decimal amount = 10000.01m;
        var stopwatch = Stopwatch.StartNew();
        var total = 0m;
        var rows = 0;

        for (var i = 0; i < 1_000_000; i++)
        {
            var parts = PayrollAllocationService.SplitAmount(amount, ratios);
            Assert.Equal(3, parts.Length);
            Assert.Equal(amount, parts.Sum());
            total += parts.Sum();
            rows += parts.Length;
        }

        stopwatch.Stop();
        _output.WriteLine($"rows={rows}, total={total}, elapsed={stopwatch.ElapsedMilliseconds} ms");

        Assert.Equal(1_000_000 * amount, total);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromMinutes(3), $"Allocation loop too slow: {stopwatch.Elapsed}");
    }
}
