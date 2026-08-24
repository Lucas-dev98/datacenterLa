package domain

type UnitLabelData struct {
	UnitCode             string
	SKUCode              string
	GeneratedDescription *string
	ProductName          string
	Brand                *string
	CategoryName         *string
	AttributeValues      []string
}
