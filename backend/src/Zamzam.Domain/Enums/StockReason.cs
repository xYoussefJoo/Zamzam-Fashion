namespace Zamzam.Domain.Enums;

// Why a variant's stock changed. Sold and Returned are written by orders; the owner picks the others.
public enum StockReason
{
    Received,
    Sold,
    Returned,
    Damaged,
    Correction
}
