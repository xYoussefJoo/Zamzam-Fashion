using Zamzam.Domain.Common;
using Zamzam.Domain.Enums;

namespace Zamzam.Domain.Entities;

// One line of a variant's stock history: +12 Received, -1 Sold (ZF-10023), +1 Returned, ...
// Written in the same save as the stock change itself, so the history always adds up to the stock.
public class StockMovement : Entity
{
    public int VariantId { get; private set; }
    public int Change { get; private set; }            // +in / -out, never 0
    public StockReason Reason { get; private set; }
    public string? Note { get; private set; }          // order number, or the owner's note
    public string? CreatedBy { get; private set; }     // the owner's user id; null = the shop itself (checkout)

    private StockMovement() { } // EF Core

    public StockMovement(int variantId, int change, StockReason reason, string? note, string? createdBy)
    {
        VariantId = Guard.Positive(variantId, "Variant");
        Change = change != 0 ? change : throw new Exceptions.DomainException(Constants.ErrorCodes.Validation, "The change can't be 0.");
        Reason = reason;
        Note = Guard.Optional(note, "Note", 200);
        CreatedBy = createdBy;
    }
}
