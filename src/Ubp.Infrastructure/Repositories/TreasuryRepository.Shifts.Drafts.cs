using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Ubp.Infrastructure.Repositories;

public partial interface ITreasuryRepository
{
    /// <summary>إيصالات قبض مسودة لعملية تعديل/بيع داخل شفت (لا تشمل العكسي).</summary>
    Task<IReadOnlyList<Guid>> ListDraftReceiptIdsForShiftAsync(Guid shiftId,
        CancellationToken ct = default);
}
