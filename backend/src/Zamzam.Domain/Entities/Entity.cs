namespace Zamzam.Domain.Entities;

public abstract class Entity
{
    public int Id { get; private set; }

    // Set by the DbContext when saving, so the Domain never reads the clock itself.
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
}
