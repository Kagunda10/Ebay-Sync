import { Card, FormLayout, TextField, Checkbox, ButtonGroup, Button } from '@shopify/polaris';
import { useRef, useState } from 'react';

export default function UpdateForm({ currentUrl, setCurrentUrl, productData, translations, fetcher, shop, setCurrentMarkup, markup }) {
    const actionTypeRef = useRef(null);
    const [notifyLowStock, setNotifyLowStock] = useState(productData.notifyLowStock);

    const handleButtonClick = (actionType) => {
        if (actionTypeRef.current) {
            actionTypeRef.current.value = actionType;
        }
    };

    const handleCheckboxChange = (newChecked) => {
        setNotifyLowStock(newChecked);
    };

    return (
        <fetcher.Form method="post">
            <Card title="Update Product URL">
                <FormLayout>
                    <div style={{ display: 'flex', justifyContent: 'right', marginTop: '12px' }}>
                        <Button variant="tertiary" submit onClick={() => handleButtonClick("refresh")} >Refresh variant data</Button>
                    </div>

                    <TextField
                        label="Variant SKU"
                        value={productData.sku}
                        disabled
                        aria-label="Variant SKU"
                    />
                    <TextField
                        label="Variant URL"
                        value={currentUrl}
                        onChange={(value) => setCurrentUrl(value)}
                        name="newUrl"
                        type="text"
                        aria-label="Enter the product URL"
                    />
                    <Checkbox
                        label="Notify when stock levels are low"
                        checked={notifyLowStock}
                        onChange={handleCheckboxChange}
                        name="notifyLowStock"
                        value={notifyLowStock ? "true" : "false"}
                    />
                    <TextField
                        label="Markup"
                        name="markup"
                        type="number"
                        value={markup}
                        onChange={(value) => setCurrentMarkup(value)}
                        suffix="%"
                        autoComplete="off"
                    />
                    <input type="hidden" name="sku" value={productData.sku} />
                    <input type="hidden" name="shop" value={shop} />
                    <input type="hidden" name="actionType" ref={actionTypeRef} />
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                        <ButtonGroup>
                            <Button primary submit onClick={() => handleButtonClick("update")}>{translations.update || "Update URL"}</Button>
                            <Button primary tone="critical" submit onClick={() => handleButtonClick("delete")}>{translations.delete || "Delete Product"}</Button>
                        </ButtonGroup>
                    </div>
                </FormLayout>
            </Card>
        </fetcher.Form>
    );
}
