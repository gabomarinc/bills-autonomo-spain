
import { create } from 'xmlbuilder2';
import { Invoice, UserProfile, InvoiceItem } from '../types';

/**
 * Helper to format date as YYYY-MM-DD
 */
const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split('T')[0];
};

/**
 * Interface for Client Data expected for FacturaE
 */
export interface FacturaEClientData {
    name: string;
    nif: string;
    type: 'business' | 'individual';
    address?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    country?: string;
}

/**
 * Generates an XML string compliant with Facturae 3.2.2 spec
 */
export const generateFacturaeXML = (invoice: Invoice, issuer: UserProfile, client: FacturaEClientData): string => {

    const currency = invoice.currency || 'EUR';

    // Calculate Subtotal manually as it is not in Invoice type
    const subtotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const total = invoice.total.toFixed(2);
    const totalGross = subtotal.toFixed(2);
    // Calculate distinct taxes if needed, here we simplify assuming uniform tax or aggregated
    const totalTax = (invoice.total - subtotal).toFixed(2);

    // Address Parsing Helpers
    // If issuer address is a single string "Calle Fake 123, Madrid, 28000"
    // logic is weak without structured address. We will provide defaults.

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('fe:Facturae', {
            'xmlns:fe': 'http://www.facturae.es/Facturae/2014/v3.2.2/Facturae',
            'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#'
        })
        .ele('FileHeader')
        .ele('SchemaVersion').txt('3.2.2').up()
        .ele('Modality').txt('I').up() // I = Individual
        .ele('InvoiceIssuerType').txt('EM').up() // EM = Emisor
        .ele('Batch')
        .ele('BatchIdentifier').txt(invoice.id).up()
        .ele('InvoicesCount').txt('1').up()
        .ele('TotalInvoicesAmount')
        .ele('TotalAmount').txt(total).up()
        .up()
        .ele('TotalOutstandingAmount')
        .ele('TotalAmount').txt(total).up()
        .up()
        .ele('TotalExecutableAmount')
        .ele('TotalAmount').txt(total).up()
        .up()
        .ele('InvoiceCurrencyCode').txt(currency).up()
        .up()
        .up() // End FileHeader

        .ele('Parties')
        // Seller (Emisor)
        .ele('SellerParty')
        .ele('TaxIdentification')
        .ele('PersonTypeCode').txt('F').up() // F = Fisico (Autonomo) default
        .ele('ResidenceTypeCode').txt('R').up() // R = Residente
        .ele('TaxIdentificationNumber').txt(issuer.taxId || '00000000T').up()
        .up()
        .ele('Individual') // Assuming Autonomo
        .ele('Name').txt(issuer.name || 'Unknown Name').up()
        .ele('FirstSurname').txt(issuer.name ? issuer.name.split(' ')[1] || '' : '').up()
        .ele('AddressInSpain')
        .ele('Address').txt(issuer.address || 'Unknown Address').up()
        .ele('PostCode').txt('00000').up() // Default if unknown
        .ele('Town').txt('Unknown').up()
        .ele('Province').txt('Unknown').up()
        .ele('CountryCode').txt('ESP').up()
        .up()
        .up()
        .up() // End SellerParty

        // Buyer (Receptor)
        .ele('BuyerParty')
        .ele('TaxIdentification')
        .ele('PersonTypeCode').txt(client.type === 'business' ? 'J' : 'F').up()
        .ele('ResidenceTypeCode').txt('R').up()
        .ele('TaxIdentificationNumber').txt(client.nif || '00000000T').up()
        .up()
        // Simplify: Just use LegalEntity for businesses or Individual for persons
        .ele(client.type === 'business' ? 'LegalEntity' : 'Individual')
        .ele(client.type === 'business' ? 'CorporateName' : 'Name').txt(invoice.clientName).up()
        .ele('AddressInSpain') // Assume Spain for now
        .ele('Address').txt(client.address || invoice.clientAddress || 'Unknown Address').up()
        .ele('PostCode').txt(client.zipCode || '00000').up()
        .ele('Town').txt(client.city || 'Unknown').up()
        .ele('Province').txt(client.province || 'Unknown').up()
        .ele('CountryCode').txt('ESP').up()
        .up()
        .up()
        .up() // End BuyerParty
        .up() // End Parties

        .ele('Invoices')
        .ele('Invoice')
        .ele('InvoiceHeader')
        .ele('InvoiceNumber').txt(invoice.id).up()
        .ele('InvoiceSeriesCode').txt('').up() // Optional
        .ele('InvoiceDocumentType').txt('FC').up() // FC = Factura Completa
        .ele('InvoiceClass').txt('OO').up() // OO = Original
        .up()
        .ele('InvoiceIssueData')
        .ele('IssueDate').txt(formatDate(invoice.date)).up()
        .ele('InvoiceCurrencyCode').txt(currency).up()
        .ele('TaxCurrencyCode').txt(currency).up()
        .ele('LanguageName').txt('es').up()
        .up()

        // Taxes (Simplified: Assume 21% IVA if tax exists)
        .ele('TaxesOutputs')
        .ele('Tax')
        .ele('TaxTypeCode').txt('01').up() // 01 = IVA
        .ele('TaxRate').txt('21.00').up() // Hardcoded 21 for example, ideally from InvoiceItem logic
        .ele('TaxableBase')
        .ele('TotalAmount').txt(totalGross).up()
        .up()
        .ele('TaxAmount')
        .ele('TotalAmount').txt(totalTax).up()
        .up()
        .up()
        .up()

        .ele('InvoiceTotals')
        .ele('TotalGrossAmount').txt(totalGross).up()
        .ele('TotalGeneralDiscounts').txt('0.00').up()
        .ele('TotalGeneralSurcharges').txt('0.00').up()
        .ele('TotalGrossAmountBeforeTaxes').txt(totalGross).up()
        .ele('TotalTaxOutputs').txt(totalTax).up()
        .ele('TotalTaxesWithheld').txt('0.00').up() // IRPF would go here
        .ele('InvoiceTotal').txt(total).up()
        .ele('TotalOutstandingAmount').txt(total).up()
        .ele('TotalExecutableAmount').txt(total).up()
        .up()

        .ele('Items')
        // Items will be added below
        .up() // End Items
        .up() // End Invoice
        .up(); // End Invoices

    // Add Items
    const itemsNode = doc.find(n => n.node.nodeName === 'Items');
    if (itemsNode) {
        invoice.items.forEach((item, index) => {
            const taxableBase = (item.quantity * item.price).toFixed(2);
            const itemTotal = (item.quantity * item.price * 1.21).toFixed(2); // Assuming 21% tax for simplicity of MVP
            itemsNode.ele('InvoiceLine')
                .ele('ItemDescription').txt(item.description).up()
                .ele('Quantity').txt(item.quantity.toString()).up()
                .ele('UnitPriceWithoutTax').txt(item.price.toFixed(2)).up()
                .ele('TotalCost').txt(taxableBase).up()
                .ele('GrossAmount').txt(taxableBase).up()
                .ele('TaxesOutputs')
                .ele('Tax')
                .ele('TaxTypeCode').txt('01').up()
                .ele('TaxRate').txt('21.00').up()
                .ele('TaxableBase')
                .ele('TotalAmount').txt(taxableBase).up()
                .up()
                .ele('TaxAmount')
                .ele('TotalAmount').txt((item.quantity * item.price * 0.21).toFixed(2)).up()
                .up()
                .up()
                .up()
                .up();
        });
    }

    return doc.end({ prettyPrint: true });
};
