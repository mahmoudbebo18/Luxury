-- Default content: automatic emails, the three services, and the legal pages (drafts for the
-- client to review from the admin; every edit is versioned).

-- ---------------------------------------------------------------- Emails
-- Placeholders: {{name}} {{member_no}} {{expires_at}} {{account_url}} {{checkout_url}} {{company_url}}
-- {{admin_url}} {{order_no}} {{order_type_label}} {{quantity}} {{total}} {{subtotal}} {{vat_amount}}
-- {{company}} {{inviter}} {{invite_url}} {{days}} {{seats}} {{contact}} {{phone}} {{email}} {{method}}
insert into public.email_templates (kind, label, subject, body_html, subject_en, body_html_en) values
('payment_receipt', 'إيصال الدفع', 'تم الدفع: {{order_no}}',
 '<p>أهلًا {{name}}،</p>
<p>شكرًا لك، استلمنا دفعتك وتم تفعيل {{order_type_label}}.</p>
<table class="receipt">
<tr><td>رقم الطلب</td><td>{{order_no}}</td></tr>
<tr><td>العدد</td><td>{{quantity}}</td></tr>
<tr><td>المبلغ قبل الضريبة</td><td>{{subtotal}} ريال</td></tr>
<tr><td>ضريبة القيمة المضافة</td><td>{{vat_amount}} ريال</td></tr>
<tr><td><strong>الإجمالي</strong></td><td><strong>{{total}} ريال</strong></td></tr>
<tr><td>سارية حتى</td><td>{{expires_at}}</td></tr>
</table>
<p><a class="btn" href="{{account_url}}">الذهاب إلى حسابي</a></p>',
 'Payment received: {{order_no}}',
 '<p>Hello {{name}},</p>
<p>Thank you. We received your payment and your {{order_type_label}} is now active.</p>
<table class="receipt">
<tr><td>Order</td><td>{{order_no}}</td></tr>
<tr><td>Quantity</td><td>{{quantity}}</td></tr>
<tr><td>Amount before VAT</td><td>SAR {{subtotal}}</td></tr>
<tr><td>VAT</td><td>SAR {{vat_amount}}</td></tr>
<tr><td><strong>Total</strong></td><td><strong>SAR {{total}}</strong></td></tr>
<tr><td>Valid until</td><td>{{expires_at}}</td></tr>
</table>
<p><a class="btn" href="{{account_url}}">Go to my account</a></p>'),

('renewal_reminder', 'تذكير التجديد', 'عضويتك تنتهي خلال {{days}} يوم',
 '<p>أهلًا {{name}}،</p>
<p>عضويتك رقم <strong>{{member_no}}</strong> تنتهي في <strong>{{expires_at}}</strong>.</p>
<p>جدّدها الآن وتُضاف السنة الجديدة إلى تاريخ الانتهاء الحالي، فلا يضيع عليك أي يوم.</p>
<p><a class="btn" href="{{checkout_url}}">جدّد عضويتي</a></p>',
 'Your membership ends in {{days}} days',
 '<p>Hello {{name}},</p>
<p>Your membership <strong>{{member_no}}</strong> ends on <strong>{{expires_at}}</strong>.</p>
<p>Renew now and the new year is added to your current end date, so you don''t lose a day.</p>
<p><a class="btn" href="{{checkout_url}}">Renew my membership</a></p>'),

('expired', 'انتهاء العضوية', 'انتهت عضويتك في The Luxury Club',
 '<p>أهلًا {{name}}،</p>
<p>انتهت عضويتك رقم <strong>{{member_no}}</strong> في <strong>{{expires_at}}</strong>، ولن تتمكن من طلب الخدمات حتى التجديد.</p>
<p><a class="btn" href="{{checkout_url}}">جدّد عضويتي</a></p>',
 'Your The Luxury Club membership has ended',
 '<p>Hello {{name}},</p>
<p>Your membership <strong>{{member_no}}</strong> ended on <strong>{{expires_at}}</strong>. You can request services again once you renew.</p>
<p><a class="btn" href="{{checkout_url}}">Renew my membership</a></p>'),

('company_renewal', 'تذكير تجديد عضويات الشركة', 'عضويات {{company}} تنتهي خلال {{days}} يوم',
 '<p>أهلًا {{name}}،</p>
<p>عضويات <strong>{{company}}</strong> ({{seats}} عضوية) تنتهي في <strong>{{expires_at}}</strong>.</p>
<p>جدّدها من لوحة الشركة بفاتورة واحدة، ويحتفظ كل موظف بعضويته وبطاقته.</p>
<p><a class="btn" href="{{company_url}}">لوحة الشركة</a></p>',
 '{{company}} memberships end in {{days}} days',
 '<p>Hello {{name}},</p>
<p>The memberships of <strong>{{company}}</strong> ({{seats}} seats) end on <strong>{{expires_at}}</strong>.</p>
<p>Renew them from your company dashboard with one invoice; every employee keeps their membership and card.</p>
<p><a class="btn" href="{{company_url}}">Company dashboard</a></p>'),

('invite', 'دعوة موظف', '{{company}} تدعوك لعضوية The Luxury Club',
 '<p>أهلًا {{name}}،</p>
<p>أضافتك <strong>{{company}}</strong> إلى عضويات The Luxury Club المقدّمة لموظفيها. العضوية تشمل الاستشارات القانونية، والمساعدة على الطريق، وتأشيرات السفر.</p>
<p>أنشئ حسابك بنفس هذا البريد لتفعيل عضويتك وبطاقتك الرقمية.</p>
<p><a class="btn" href="{{invite_url}}">تفعيل عضويتي</a></p>
<p style="color:#6b6e5e;font-size:13px">إذا لم تكن تتوقع هذه الرسالة يمكنك تجاهلها.</p>',
 '{{company}} invites you to The Luxury Club',
 '<p>Hello {{name}},</p>
<p><strong>{{company}}</strong> has added you to the The Luxury Club memberships it provides to its team. Your membership covers legal consultations, roadside assistance and travel visas.</p>
<p>Create your account with this same email address to activate your membership and digital card.</p>
<p><a class="btn" href="{{invite_url}}">Activate my membership</a></p>
<p style="color:#6b6e5e;font-size:13px">If you weren''t expecting this email, you can ignore it.</p>'),

('seat_activated', 'تفعيل عضوية موظف', 'عضويتك عبر {{company}} مفعّلة',
 '<p>أهلًا {{name}}،</p>
<p>تم تفعيل عضويتك في The Luxury Club عبر <strong>{{company}}</strong>. رقم عضويتك <strong>{{member_no}}</strong>، وهي سارية حتى <strong>{{expires_at}}</strong>.</p>
<p><a class="btn" href="{{account_url}}">عرض بطاقتي</a></p>',
 'Your membership through {{company}} is active',
 '<p>Hello {{name}},</p>
<p>Your The Luxury Club membership through <strong>{{company}}</strong> is active. Your member number is <strong>{{member_no}}</strong>, valid until <strong>{{expires_at}}</strong>.</p>
<p><a class="btn" href="{{account_url}}">View my card</a></p>'),

('seat_released', 'إلغاء عضوية موظف', 'انتهت عضويتك عبر {{company}}',
 '<p>أهلًا {{name}}،</p>
<p>أنهت <strong>{{company}}</strong> عضويتك المقدّمة عبرها. حسابك ما زال موجودًا، ويمكنك الاشتراك بعضوية فردية في أي وقت.</p>
<p><a class="btn" href="{{checkout_url}}">عضوية فردية</a></p>',
 'Your membership through {{company}} has ended',
 '<p>Hello {{name}},</p>
<p><strong>{{company}}</strong> has ended the membership it provided you. Your account is still here, and you can take an individual membership any time.</p>
<p><a class="btn" href="{{checkout_url}}">Individual membership</a></p>'),

('unpaid_reminder', 'تذكير إكمال الدفع', 'خطوة واحدة لتفعيل عضويتك',
 '<p>أهلًا {{name}}،</p>
<p>حسابك جاهز، وبقي تفعيل العضوية لتبدأ بطلب الخدمات واستخدام بطاقتك الرقمية.</p>
<p><a class="btn" href="{{checkout_url}}">أكمل الدفع</a></p>',
 'One step to activate your membership',
 '<p>Hello {{name}},</p>
<p>Your account is ready. Activate your membership to start requesting services and use your digital card.</p>
<p><a class="btn" href="{{checkout_url}}">Complete payment</a></p>'),

('admin_payment', 'تنبيه الإدارة: دفعة جديدة', 'دفعة جديدة: {{order_no}} ({{total}} ريال)',
 '<p>دفعة جديدة.</p>
<p>الطلب: <strong>{{order_no}}</strong><br>النوع: {{order_type_label}} × {{quantity}}<br>الاسم: {{name}}<br>المبلغ: {{total}} ريال<br>الطريقة: {{method}}</p>
<p><a class="btn" href="{{admin_url}}/payments">المدفوعات</a></p>', '', ''),

('admin_quote', 'تنبيه الإدارة: طلب عرض سعر', 'طلب عرض سعر: {{company}} ({{quantity}} عضوية)',
 '<p>طلب عرض سعر جديد من شركة.</p>
<p>الشركة: <strong>{{company}}</strong><br>العدد: {{quantity}}<br>السعر حسب الشرائح: {{total}} ريال<br>المسؤول: {{contact}} · {{phone}} · {{email}}</p>
<p><a class="btn" href="{{admin_url}}/payments">مراجعة الطلب</a></p>', '', '');

-- ---------------------------------------------------------------- Services
insert into public.services (slug, sort_order, icon, title_ar, title_en, summary_ar, summary_en, features_ar, features_en,
                             how_ar, how_en, message_ar, message_en, annual_quota, quota_label_ar, quota_label_en,
                             email, whatsapp, ask_location) values
('legal', 1, 'legal', 'استشارات قانونية', 'Legal consultations',
 'نخبة من المحامين والمستشارين القانونيين لاستشاراتك الخاصة، ومتابعة معاملاتك العدلية عبر منصة ناجز.',
 'Experienced lawyers and legal advisors for your private matters, and follow-up of your court transactions through Najiz.',
 array['استشارات قانونية خاصة وسرية', 'خدمات مختارة عبر منصة ناجز', 'التوجيه القانوني ومراجعة المستندات'],
 array['Private, confidential consultations', 'Selected services through Najiz', 'Legal guidance and document review'],
 'أرسل استشارتك للمحامي بالبريد من بريدك الشخصي، واشرح الموضوع وأرفق أي مستندات. يرد عليك المحامي على نفس البريد.',
 'Email your question to the lawyer from your own mailbox, explain the matter and attach any documents. The lawyer replies to the same address.',
 E'نوع الخدمة (استشارة / ناجز):\nتفاصيل الموضوع:', E'Type (consultation / Najiz):\nDetails:',
 null, 'استشارة', 'consultation', 'info@the-luxury-club.com', null, false),
('roadside', 2, 'roadside', 'مساعدة على الطريق', 'Roadside assistance',
 'تتعطل سيارتك؟ أرسل موقعك، ونرسل لك المساعدة داخل المدينة وخارجها.',
 'Car broke down? Send your location and help is on its way, in the city or on the highway.',
 array['سحب السيارة بالسطحة المناسبة لمركبتك', 'الإطارات: الإصلاح في الموقع أو النقل لمركز مختص', 'شحن البطارية أو استبدالها', 'توصيل البنزين أو الديزل'],
 array['Towing with the right flatbed for your vehicle', 'Tyres: fixed on the spot or taken to a specialist', 'Battery charge or replacement', 'Petrol or diesel delivery'],
 'اضغط زر واتساب لتصل رسالة طلب المساعدة برقم عضويتك وموقعك الحالي، واكتب نوع العطل ونوع السيارة.',
 'Tap the WhatsApp button to send a help request with your member number and current location, then add the problem and your car.',
 E'نوع المساعدة (سحب / إطار / بطارية / وقود):\nنوع السيارة ولونها:', E'Help needed (towing / tyre / battery / fuel):\nCar make and colour:',
 null, 'طلب', 'request', null, '966558103228', true),
('visas', 3, 'passport', 'تأشيرات السفر', 'Travel visas',
 'نُنجز طلب تأشيرتك السياحية من البداية للنهاية، بدون رسوم خدمة إضافية. تدفع رسوم السفارة فقط.',
 'We take your tourist visa application from start to finish with no extra service fee. You pay embassy fees only.',
 array['تجهيز الطلب والمستندات المطلوبة', 'حجز موعد السفارة أو مركز التأشيرات', 'المتابعة حتى إصدار التأشيرة'],
 array['Application and required documents prepared', 'Embassy or visa-centre appointment booked', 'Followed up until the visa is issued'],
 'راسلنا على واتساب بالدولة وتاريخ السفر، ونرسل لك قائمة المستندات المطلوبة.',
 'Message us on WhatsApp with the country and travel date, and we''ll send you the list of documents.',
 E'الدولة:\nتاريخ السفر:\nعدد المسافرين:', E'Country:\nTravel date:\nNumber of travellers:',
 null, 'تأشيرة', 'visa', null, '966558103228', false);

-- ---------------------------------------------------------------- Legal pages (drafts)
insert into public.site_pages (slug, title_ar, title_en, body_ar, body_en) values
('terms', 'الشروط والأحكام', 'Terms & conditions',
'## التعريفات
- **النادي:** The Luxury Club، المملوك والمُدار من مؤسسة المسيلة لخدمات الأعمال.
- **العضو:** كل شخص لديه عضوية سارية، فردية أو عبر شركة.
- **مقدّم الخدمة:** الجهة المتعاقدة مع النادي التي تنفّذ الخدمة (مكتب محاماة، شركة مساعدة على الطريق، مكتب تأشيرات).

## العضوية
- مدة العضوية سنة ميلادية تبدأ من تاريخ الدفع، وقيمتها 699 ريالًا شاملة ضريبة القيمة المضافة.
- العضوية شخصية ولا يجوز نقلها أو مشاركة بيانات الدخول، عدا عضويات الشركات التي يديرها مسؤول الشركة وفق هذه الشروط.
- يقر العضو بأنه فوق 18 عامًا وبأن بياناته صحيحة.

## الخدمات وحدودها
- **الاستشارات القانونية:** [عدد الاستشارات وخدمات ناجز المشمولة سنويًا].
- **المساعدة على الطريق:** [عدد الطلبات، والنطاق الجغرافي، وما يشمله السحب].
- **تأشيرات السفر:** [عدد الطلبات]، والرسوم الحكومية ورسوم السفارة على العضو.
- دور النادي التنسيق مع مقدّمي الخدمات، ومسؤولية جودة الخدمة على مقدّمها وفق اتفاقه مع النادي.

## عضويات الشركات
- تنتهي جميع عضويات الشركة في تاريخ واحد، ويمكن نقل العضوية من موظف لآخر من لوحة الشركة.
- حدود الخدمات مرتبطة بالعضوية نفسها ولا تتجدد عند نقلها لموظف آخر.

## الدفع والتجديد
- يتم الدفع عبر بوابة دفع آمنة، ولا يحتفظ النادي ببيانات البطاقات.
- يُذكَّر العضو قبل انتهاء العضوية، والتجديد يُضاف إلى تاريخ الانتهاء الحالي.
- الاسترجاع وفق [سياسة الاسترجاع والإلغاء](/refund).

## أحكام عامة
- يحق للنادي تعديل هذه الشروط، ويُعلن التعديل على هذه الصفحة مع تاريخ آخر تحديث.
- تخضع هذه الشروط لأنظمة المملكة العربية السعودية.',
'## Definitions
- **The club:** The Luxury Club, owned and operated by Al-Musaylah Business Services Est.
- **Member:** anyone with an active membership, individual or through a company.
- **Provider:** the party contracted by the club to deliver a service (law firm, roadside assistance company, visa office).

## Membership
- A membership lasts one calendar year from the payment date and costs SAR 699 including VAT.
- A membership is personal and may not be transferred or shared, except company memberships managed by the company administrator under these terms.
- The member confirms they are over 18 and that their details are accurate.

## Services and limits
- **Legal consultations:** [number of consultations and Najiz services included per year].
- **Roadside assistance:** [number of requests, coverage area, what towing includes].
- **Travel visas:** [number of applications]; government and embassy fees are paid by the member.
- The club coordinates with providers; each provider is responsible for the quality of its service under its agreement with the club.

## Company memberships
- All of a company''s memberships end on the same date, and a membership can be moved from one employee to another from the company dashboard.
- Service limits belong to the membership itself and do not reset when it is moved to another employee.

## Payment and renewal
- Payments are made through a secure payment gateway; the club does not store card details.
- Members are reminded before their membership ends, and a renewal is added to the current end date.
- Refunds follow the [refund and cancellation policy](/en/refund).

## General
- The club may update these terms; changes are published on this page with the last-updated date.
- These terms are governed by the laws of the Kingdom of Saudi Arabia.'),

('privacy', 'سياسة الخصوصية', 'Privacy policy',
'## البيانات التي نجمعها
الاسم، والبريد الإلكتروني، ورقم الجوال، والمدينة. ولعضويات الشركات: اسم الشركة وسجلها التجاري ورقمها الضريبي وبيانات المسؤول.

## كيف نستخدمها
- لإنشاء حسابك وتفعيل عضويتك وإرسال الإيصالات والتذكيرات.
- لتنفيذ الخدمات التي تطلبها، ونشارك مع مقدّم الخدمة ما يلزم لتنفيذ طلبك فقط.

## الدفع
تتم المدفوعات عبر بوابة ماي فاتورة، ولا تمر بيانات بطاقتك بخوادمنا ولا نحتفظ بها.

## خصوصية عضويات الشركات
مسؤول الشركة يرى أسماء الموظفين وحالة عضوياتهم فقط، ولا يرى الخدمات التي يطلبها أي موظف.

## حقوقك
يمكنك تعديل بياناتك من حسابك في أي وقت، أو طلب حذف حسابك بمراسلتنا على info@the-luxury-club.com.',
'## What we collect
Your name, email address, mobile number and city. For company memberships: the company name, CR number, VAT number and the administrator''s details.

## How we use it
- To create your account, activate your membership, and send receipts and reminders.
- To deliver the services you request; we share with the provider only what is needed for your request.

## Payments
Payments are processed by MyFatoorah. Your card details never pass through or stay on our servers.

## Company memberships
A company administrator sees employees'' names and membership status only, never the services an employee requests.

## Your rights
You can update your details from your account at any time, or ask us to delete your account at info@the-luxury-club.com.'),

('refund', 'الاسترجاع والإلغاء', 'Refunds & cancellation',
'## قبل استخدام أي خدمة
يحق لك طلب إلغاء العضوية واسترداد المبلغ كاملًا خلال [7] أيام من تاريخ الدفع، بشرط عدم استخدام أي خدمة من خدمات العضوية.

## بعد استخدام خدمة أو بعد المدة
لا يُسترد مبلغ العضوية بعد استخدام أي خدمة أو بعد انقضاء المدة أعلاه.

## عضويات الشركات
[شروط استرداد عضويات الشركات، مثلًا: العضويات غير المفعّلة خلال 7 أيام من الدفع].

## طريقة الطلب
راسلنا على info@the-luxury-club.com برقم الطلب، ويُعاد المبلغ إلى وسيلة الدفع نفسها خلال [14] يوم عمل من الموافقة.',
'## Before using any service
You may cancel your membership and receive a full refund within [7] days of payment, provided no membership service has been used.

## After using a service or after that period
The membership fee is not refundable once a service has been used or after the period above.

## Company memberships
[Refund terms for company memberships, e.g. seats not activated within 7 days of payment].

## How to request
Email info@the-luxury-club.com with your order number. Refunds go back to the original payment method within [14] working days of approval.'),

('rules', 'قواعد النادي', 'Club rules',
'## الاسم والمالك
اسم النادي «The Luxury Club»، ومقره مركز الجوهرة المكتبي، شارع الأمير محمد بن عبدالعزيز، حي العليا، الرياض. يملكه ويديره مؤسسة المسيلة لخدمات الأعمال.

## العضوية
- العضوية متاحة للرجال والنساء من عمر 18 عامًا فأكثر.
- يجوز للنادي طلب إثبات الهوية عند الحاجة، ورفض أو إيقاف أي عضوية تخالف هذه القواعد أو الشروط والأحكام.

## السلوك
يلتزم العضو بالاحترام في التعامل مع فريق النادي ومقدّمي الخدمات، ويحق للنادي إيقاف العضوية عند الإساءة أو إساءة استخدام الخدمات.',
'## Name and owner
The club is "The Luxury Club", based at Al Jawhara Office Center, Prince Mohammed bin Abdulaziz Street, Olaya, Riyadh. It is owned and operated by Al-Musaylah Business Services Est.

## Membership
- Membership is open to men and women aged 18 and over.
- The club may ask for proof of identity when needed, and may refuse or suspend any membership that breaks these rules or the terms & conditions.

## Conduct
Members treat the club''s team and providers with respect. The club may suspend a membership for abuse or misuse of the services.'),

('faq', 'الأسئلة الشائعة', 'FAQ', '', '');
