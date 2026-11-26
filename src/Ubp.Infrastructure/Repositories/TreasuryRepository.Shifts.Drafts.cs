using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Ubp.Infrastructure.Repositories;

public partial interface ITreasuryRepository
{
    /// <summary>
    /// إيصالات القبض المسودة التي تُرحَّل عند «اعتماد المراجعة»، مع اعتماد السندات المسودة
    /// التي أُنشئت خلال الشفت بدون ربط (`shift_id = NULL`).
    /// </summary>
    Task<IReadOnlyList<Guid>> AdoptAndListDraftReceiptIdsForShiftAsync(Guid shiftId,
        CancellationToken ct = default);
}
