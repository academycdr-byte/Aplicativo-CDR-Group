export default function PrivacyPage() {
    return (
        <div className="container mx-auto py-10 px-4 max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
                    <p>
                        CDR Analytics ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you install/use our Shopify application.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">2. Information We Collect</h2>
                    <p>
                        When you install the App, we are automatically able to access certain types of information from your Shopify account:
                    </p>
                    <ul className="list-disc list-inside mt-2 ml-4">
                        <li>Shop information (domain, email, currency)</li>
                        <li>Customer data (names, emails) associated with orders</li>
                        <li>Order and Product data (transactions, inventory)</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">3. How We Use Your Information</h2>
                    <p>
                        We use the personal information we collect from you and your customers in order to provide the Service and to operate the App. Specifically, we use it to:
                    </p>
                    <ul className="list-disc list-inside mt-2 ml-4">
                        <li>Generate financial reports and analytics dashboards.</li>
                        <li>Calculate profit margins and ROI.</li>
                        <li>Sync your sales data across multiple platforms.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">4. Data Sharing</h2>
                    <p>
                        We do not share your personal information with third parties unless required by law or to protect our rights.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">5. Contact Us</h2>
                    <p>
                        For more information about our privacy practices, if you have questions, or if you would like to make a complaint, please contact us by e-mail at academy.cdr@gmail.com.
                    </p>
                </section>
            </div>
        </div>
    );
}
