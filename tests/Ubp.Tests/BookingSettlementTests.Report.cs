using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تقرير الشفت لتسوية حساب العميل: كل حركات التسوية للعميل الواحد تظهر في سطر واحد
/// تُجمع فيه الأعمدة (المحصّل/الإيراد/الكمية) ويظهر الصافي.
/// </summary>
public sealed partial class BookingSettlementTests
{
    [Fact]
    public async Task Shift_report_shows_the_customer_settlement_as_one_net_row()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("RPT", pay: 200);
        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = f.Branch });

        await SettleAsync(f, actor);
        var report = await shifts.GetShiftReportAsync(actor, shift.Id);

        // سطر واحد فقط للعميل: الاسترداد والكمية والإيراد في نفس السطر.
        var row = Assert.Single(report.Lines);
        Assert.Equal("تسوية حساب عميل", row.Source);
        Assert.Equal(f.Customer.NameAr, row.CustomerName);
        Assert.Equal(TreasuryTypes.Cash, row.TreasuryType);
        Assert.Equal(-100m, row.Collected);
        Assert.Equal(3m, row.Quantity);
        Assert.Equal(-100m, row.Revenue);
        Assert.Contains(await ServiceNameAsync(f.ServiceId), row.ItemName ?? "");
        Assert.Equal(-100m, report.CollectionsTotal);
        Assert.Equal(-100m, report.RevenuesTotal);

        // حركة النقد في عدّ الخزينة تعكس الاسترداد مرة واحدة أيضًا.
        Assert.Equal(-100m, Assert.Single(report.CashCounts).Movement);
    }

    [Fact]
    public async Task New_booking_settlement_merges_cash_and_quantity_into_one_row()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("NRPT", pay: 200);
        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = f.Branch });

        // المستحق 100 والعروض الجديدة 50 => صافي استرداد نقدي 50.
        await _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = f.Customer.Id, TreasuryId = f.TreasuryId,
            SettlementType = BookingSettlementTypes.NewBooking,
            NewBookingLines =
            {
                new NewBookingLineInput { ItemId = f.ServiceId, Quantity = 1, UnitPrice = 50 }
            },
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = f.Booking.Id, BookingLineId = f.LineId, ExternalUnitPrice = 50
                }
            }
        });

        var report = await shifts.GetShiftReportAsync(actor, shift.Id);

        var row = Assert.Single(report.Lines);
        Assert.Equal("تسوية حساب عميل", row.Source);
        Assert.Equal(-50m, row.Collected);
        Assert.Equal(3m, row.Quantity);
        Assert.Equal(-100m, row.Revenue);
        Assert.Contains(await ServiceNameAsync(f.ServiceId), row.ItemName ?? "");
    }

    [Fact]
    public async Task Multiple_settlements_of_one_customer_are_summed_into_one_row()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("MRPT", pay: 200);
        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = f.Branch });

        await SettleAsync(f, actor);

        // تسوية ثانية لنفس العميل في نفس الشفت: تحصيل فرق 40 من الخزينة.
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var secondVoucher = Guid.CreateVersion7();
            await connection.ExecuteAsync("""
                INSERT INTO vouchers (id, branch_id, doc_date, status, voucher_type, party_type,
                    party_id, party_name, treasury_id, total_amount, fee_total, notes)
                VALUES (@id, @branch, current_date, 'draft', 'receipt', 'C', @customer, @name,
                        @treasury, 40, 0, 'ايصال تسوية حساب عميل — تحصيل فرق')
                """, new
            {
                id = secondVoucher, branch = f.Branch, customer = f.Customer.Id,
                name = f.Customer.NameAr, treasury = f.TreasuryId
            });
            var secondSettlement = Guid.CreateVersion7();
            await connection.ExecuteAsync("""
                INSERT INTO customer_account_settlements
                    (id, branch_id, customer_id, treasury_id, voucher_id, doc_date, status,
                     settlement_type, total_refund, total_settled_qty)
                VALUES (@id, @branch, @customer, @treasury, @voucher, current_date, 'draft',
                        'new_booking', 0, 0)
                """, new
            {
                id = secondSettlement, branch = f.Branch, customer = f.Customer.Id,
                treasury = f.TreasuryId, voucher = secondVoucher
            });
            await connection.ExecuteAsync("""
                INSERT INTO customer_account_settlement_cash_lines
                    (settlement_id, line_no, treasury_id, amount, direction)
                VALUES (@id, 1, @treasury, 40, 'collect')
                """, new { id = secondSettlement, treasury = f.TreasuryId });
        }

        var report = await shifts.GetShiftReportAsync(actor, shift.Id);

        // صافي العميل: استرداد 100 − تحصيل 40 = 60 في سطر واحد بلا تكرار.
        var row = Assert.Single(report.Lines);
        Assert.Equal("تسوية حساب عميل", row.Source);
        Assert.Equal(-60m, row.Collected);
        Assert.Equal(3m, row.Quantity);
        Assert.Equal(-100m, row.Revenue);
        Assert.Equal(-60m, Assert.Single(report.CashCounts).Movement);
    }

    /// <summary>اسم خدمة التسوية كما يظهر في عمود «الصنف / الخدمة».</summary>
    private static async Task<string> ServiceNameAsync(Guid serviceId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<string>(
            "SELECT name_ar FROM items WHERE id = @id", new { id = serviceId }) ?? "";
    }
}
