        // Form submission helper function
        async function submitQuoteRequest(formData, formType) {
            // Enable detailed debug logging
            const debugLog = (label, data, indent = 0) => {
                const prefix = ' '.repeat(indent);
                if (typeof data === 'object' && data !== null) {
                    console.group(`${prefix}🔍 ${label}:`);
                    Object.entries(data).forEach(([key, value]) => {
                        if (key.includes('email') && typeof value === 'string') {
                            console.log(`${prefix}  ${key}: [HIDDEN]`);
                        } else {
                            console.log(`${prefix}  ${key}:`, value);
                        }
                    });
                    console.groupEnd();
                } else {
                    console.log(`${prefix}🔍 ${label}:`, data);
                }
            };

            // Format date and time with debug
            const currentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const currentTime = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            debugLog('Formatted Date/Time', { currentDate, currentTime });

            // Debug form data
            console.group('📝 Form Data Analysis:');
            console.log('Form Type:', formType);
            console.log('Raw Form Data Entries:');
            const formDataObj = {};
            for (let [key, value] of formData.entries()) {
                if (key.includes('email')) {
                    console.log(`${key}: [HIDDEN]`);
                    formDataObj[key] = '[HIDDEN]';
                } else {
                    console.log(`${key}:`, value);
                    formDataObj[key] = value;
                }
            }
            console.groupEnd();

            // Get and validate client email first
            const clientEmail = (formData.get('email') || '').trim();
            console.log('Client email found:', clientEmail);
            
            if (!clientEmail || !clientEmail.includes('@')) {
                console.error('Invalid or missing email address');
                throw new Error('A valid email address is required');
            }
            
            // Additional validation for email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(clientEmail)) {
                console.error('Email validation failed:', clientEmail);
                throw new Error('Please enter a valid email address');
            }

            // Template variable standardization helper
            const standardizeTemplateVars = () => {
                const baseVars = {
                    destination: formData.get('hiking-site') || formData.get('safari-destination') || formData.get('venue-preference') || formData.get('itinerary-type') || 'Not specified',
                    travel_dates: formData.get('start-date') ? 
                        `${formData.get('start-date')} to ${formData.get('end-date')}` : 
                        (formData.get('safari-dates') || formData.get('preferred-dates') || 'Not specified'),
                    duration: formData.get('duration') || formData.get('safari-days') || '1',
                    group_size: formData.get('group-size') || formData.get('safari-guests') || formData.get('team-size') || '0',
                    activities: formData.getAll('activities[]').length ? 
                        formData.getAll('activities[]').join(', ') : 
                        'Not specified',
                    special_requirements: formData.get('special-requirements') || 'None',
                    budget_range: formData.get('budget-range') || 'Not specified',
                    accommodation_type: formData.get('accommodation-type') || 'Standard'
                };

                debugLog('Standardized Template Variables', baseVars);
                return baseVars;
            };

            // Get standardized variables
            const standardVars = standardizeTemplateVars();
            debugLog('Template Variables - Pre-Processing', {
                formType,
                clientEmail: '[HIDDEN]',
                dateTime: { currentDate, currentTime },
                standardVars
            });

            let emailParams = {
                // Standardized template variables first
                ...standardVars,

                // Email envelope fields for internal notification
                to_name: 'Starkville Adventures',
                to_email: 'starkvilleadventures@gmail.com',
                from_email: clientEmail,  // Use client's email as sender
                reply_to: clientEmail,
                
                // Customer information with standardized fields
                client_name: formData.get('client-name') || formData.get('fullName') || 'Website Visitor',
                client_email: clientEmail,
                phone: formData.get('whatsapp') || formData.get('phone') || 'Not provided',
                whatsapp: formData.get('whatsapp') || formData.get('phone') || 'Not provided',
                phone_number: formData.get('whatsapp') || formData.get('phone') || 'Not provided', // Legacy support
                
                // Request metadata
                subject: `New ${formType} Request`,
                request_type: formType,
                date: currentDate,
                time: currentTime,
                form_id: `WEB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ip_address: '{{client_ip}}',  // EmailJS will populate this
                user_agent: '{{user_agent}}', // EmailJS will populate this
                
                // Branding
                logo_url: 'https://res.cloudinary.com/dwpr0xrjq/image/upload/v1758725534/LOGO_WHITE_BG_harwpu.png'
            };

            // Add special fields
            let guestCount = '';
            if (formData.get('safari_guests') || formData.get('safari-guests')) {
                const safariGuests = formData.get('safari_guests') || formData.get('safari-guests');
                const safariChildren = formData.get('safari_children') || formData.get('safari-children') || '0';
                guestCount = `Adults: ${safariGuests}, Children: ${safariChildren}`;
            } else if (formData.get('adults')) {
                guestCount = `Adults: ${formData.get('adults')}, Children: ${formData.get('children') || '0'}`;
            }
            emailParams.guests = guestCount || 'Not Specified';

            // Format form details more clearly
            let formattedDetails = new Map(); // Use Map to prevent duplicates
            
            for (let [key, value] of formData.entries()) {
                // Skip fields already included in base params
                if (['client-name', 'fullName', 'phone', 'email'].includes(key)) continue;

                // Format the key for display
                let displayKey = key.split(/[_-]/).map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ').replace('[]', '');

                // Handle array fields (like activities)
                if (key.endsWith('[]')) {
                    if (!formattedDetails.has(displayKey)) {
                        let values = formData.getAll(key);
                        // Remove duplicates from array values
                        values = [...new Set(values)];
                        formattedDetails.set(displayKey, values.join(', '));
                    }
                } else if (!formattedDetails.has(displayKey)) {
                    // Only add non-array fields if they haven't been added yet
                    formattedDetails.set(displayKey, value);
                }
            }

            // Convert Map to array of formatted strings
            emailParams.message = Array.from(formattedDetails, ([key, value]) => `${key}: ${value}`).join('\n');

            try {
                // Basic validation
                if (!clientEmail) {
                    throw new Error('Email address is required');
                }
                if (!formData.get('client-name') && !formData.get('fullName')) {
                    throw new Error('Client name is required');
                }
                
                // Validate key template variables
                const requiredVars = [
                    'destination',
                    'travel_dates',
                    'duration',
                    'group_size',
                    'activities'
                ];
                
                const missingVars = requiredVars.filter(key => 
                    !emailParams[key] || 
                    emailParams[key] === 'Not specified'
                );

                if (missingVars.length > 0) {
                    console.warn('Missing or invalid template variables:', missingVars);
                    // Don't throw, just log warning - these fields may be optional
                }

                console.log('Starting email process...');
                console.log('Form Type:', formType);
                console.log('Email Parameters:', emailParams);

                // Deep debug of final email parameters
                console.group('📧 Email Parameters Debug');
                debugLog('Final Template Variables', {
                    ...emailParams,
                    email: '[HIDDEN]',
                    to_email: '[HIDDEN]',
                    from_email: '[HIDDEN]',
                    from: '[HIDDEN]',
                    reply_to: '[HIDDEN]'
                }, 2);
                console.groupEnd();

                // 1. Send internal notification email with debug tracing
                console.group('🚀 Email Sending Process');
                debugLog('Starting Internal Notification', {
                    service: 'service_0ubfwfr',
                    template: 'template_hecn3gx',
                    timestamp: new Date().toISOString()
                });

                let internalResult;
                try {
                    // Sanitize and validate parameters before sending
                    const sanitizedParams = {
                        ...emailParams,
                        from_name: String(emailParams.from_name || '').trim(),
                        to_name: String(emailParams.to_name || '').trim(),
                        subject: String(emailParams.subject || '').trim(),
                        message: String(emailParams.message || '').trim()
                    };

                    internalResult = await emailjs.send(
                        'service_0ubfwfr',
                        'template_hecn3gx',
                        sanitizedParams
                    );
                    debugLog('Internal Notification Success', internalResult);
                } catch (sendErr) {
                    console.error('Internal email send failed:', sendErr);
                    throw sendErr; // rethrow so outer catch can show dialog
                }

                // 2. Send client confirmation email with enhanced debugging
                debugLog('Client Confirmation Preparation', {
                    stage: 'pre-send',
                    templateType: formType,
                    timestamp: new Date().toISOString()
                });

                // Template variable validation function
                const validateTemplateVars = (params) => {
                    const requiredVars = [
                        'email', 'to_name', 'phone_number', 'request_type',
                        'destination', 'travel_dates', 'duration', 'group_size'
                    ];
                    
                    const missing = requiredVars.filter(v => !params[v]);
                    const debug = {
                        allVariables: Object.keys(params),
                        missingRequired: missing,
                        status: missing.length === 0 ? 'OK' : 'MISSING_REQUIRED'
                    };
                    debugLog('Template Variables Validation', debug);
                    return missing;
                };

                // Client confirmation email parameters matching standardized fields
                let clientEmailParams = {
                    // Email envelope fields (required by EmailJS)
                    from_name: 'Starkville Adventures',
                    from_email: 'notifications@starkvilleadventures.co.ke',
                    to_name: formData.get('client-name') || formData.get('fullName') || 'Valued Customer',
                    to_email: clientEmail,
                    reply_to: 'support@starkvilleadventures.co.ke',
                    subject: `Your ${formType} Quote Request - Starkville Adventures`,
                    
                    // Template system fields
                    template_id: 'template_7a5okfl',
                    service_id: 'service_0ubfwfr',
                    user_id: 'HdvilqGkifQOOqalR',
                    
                    // Branding
                    logo_url: 'https://res.cloudinary.com/dwpr0xrjq/image/upload/v1758725534/LOGO_WHITE_BG_harwpu.png',
                    company_name: 'Starkville Adventures',
                    company_address: 'Nairobi, Kenya',
                    company_website: 'https://starkvilleadventures.co.ke',
                    
                    // Contact info
                    phone: formData.get('whatsapp') || formData.get('phone') || 'Not provided',
                    whatsapp: formData.get('whatsapp') || formData.get('phone') || 'Not provided',
                    contact_email: 'support@starkvilleadventures.co.ke',
                    date: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }),

                    // Branding & Metadata
                    logo_url: 'https://res.cloudinary.com/dwpr0xrjq/image/upload/v1758725534/LOGO_WHITE_BG_harwpu.png',
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString(),
                    request_type: formType,

                    // Common Fields (shared across all request types)
                    activities: formData.getAll('activities[]').length ? formData.getAll('activities[]').join(', ') : (formData.get('activities') || 'Not specified'),
                    special_requirements: formData.get('special-requirements') || formData.get('safari_requirements') || formData.get('special_requirements') || 'None',
                    budget_range: formData.get('budget_range') || 'Not specified'
                };

                // Validate form type
                if (!['Custom Itinerary', 'Safari Tour', 'Team Building'].includes(formType)) {
                    throw new Error(`Invalid form type: ${formType}`);
                }

                // Add form-specific parameters based on form type
                // Add type-specific parameters based on the form type
                if (formType === 'Custom Itinerary') {
                    const hikingSite = formData.get('hiking-site') || 'Not specified';
                    
                    Object.assign(clientEmailParams, {
                        subject: 'Your Custom Itinerary Request - Starkville Adventures',
                        destination: hikingSite,
                        travel_dates: `${formData.get('start-date')} to ${formData.get('end-date')}`,
                        duration: formData.get('duration') || 'Not specified',
                        group_size: formData.get('group-size') || '0',
                        itinerary_type: formData.get('itinerary-type') || 'Not specified',
                        
                        // Safari-compatible fields (for template consistency)
                        safari_destination: hikingSite,
                        safari_dates: `${formData.get('start-date')} to ${formData.get('end-date')}`,
                        safari_days: formData.get('duration') || 'Not specified',
                        safari_guests: formData.get('group-size') || '0',
                        safari_children: '0',
                        accommodation_type: 'To be discussed'
                    });
                } else if (formType === 'Safari Tour') {
                    Object.assign(clientEmailParams, {
                        subject: 'Your Safari Tour Request - Starkville Adventures',
                        safari_destination: formData.get('safari_destination') || 'Not specified',
                        safari_dates: formData.get('safari_dates') || 'Not specified',
                        safari_days: formData.get('safari_days') || formData.get('duration') || 'Not specified',
                        safari_guests: formData.get('safari_guests') || '0',
                        safari_children: formData.get('safari_children') || '0',
                        accommodation_type: formData.get('accommodation_type') || 'Not specified',
                        
                        // Itinerary-compatible fields (for template consistency)
                        destination: formData.get('safari_destination') || 'Not specified',
                        travel_dates: formData.get('safari_dates') || 'Not specified',
                        duration: formData.get('safari_days') || formData.get('duration') || 'Not specified',
                        group_size: formData.get('safari_guests') || '0'
                    });
                } else if (formType === 'Team Building') {
                    Object.assign(clientEmailParams, {
                        subject: 'Your Team Building Request - Starkville Adventures',
                        company_name: formData.get('company_name') || 'Not specified',
                        team_size: formData.get('team_size') || '0',
                        preferred_dates: formData.get('preferred_dates') || 'Not specified',
                        venue_preference: formData.get('venue_preference') || 'Not specified',
                        activity_preferences: formData.getAll('activity_preferences[]').length ? 
                            formData.getAll('activity_preferences[]').join(', ') : 
                            (formData.get('activity_preferences') || 'Not specified'),
                        
                        // Template compatibility fields
                        destination: formData.get('venue_preference') || 'Not specified',
                        travel_dates: formData.get('preferred_dates') || 'Not specified',
                        duration: '1',  // Typically one day for team building
                        group_size: formData.get('team_size') || '0',
                        safari_destination: formData.get('venue_preference') || 'Not specified',
                        safari_dates: formData.get('preferred_dates') || 'Not specified',
                        safari_days: '1',
                        safari_guests: formData.get('team_size') || '0',
                        safari_children: '0',
                        accommodation_type: 'Day Event'
                    });
                }
                
                if (clientEmail) {
                    console.log('Preparing to send client confirmation email...');
                    
                    // Use the new quote request template
                    const templateId = 'template_7a5okfl';
                    const serviceId = 'service_0ubfwfr';

                    try {
                        // Enhanced validation for critical template variables
                        const criticalVars = [
                            'to_name',
                            'email',
                            'request_type',
                            'destination',
                            'travel_dates',
                            'duration',
                            'group_size'
                        ];
                        
                        const missingVars = criticalVars.filter(key => !clientEmailParams[key]);
                        if (missingVars.length > 0) {
                            debugLog('Critical Variables Missing', {
                                warning: 'Missing required variables',
                                missingVars,
                                willAttemptSend: true
                            });
                            
                            // Set default values for missing non-critical variables
                            missingVars.forEach(key => {
                                if (!['email', 'to_name'].includes(key)) {
                                    clientEmailParams[key] = 'Not specified';
                                }
                            });
                        }
                        
                        // Log all parameters for debugging
                        console.group('📧 Client Confirmation Email Attempt');
                        debugLog('Service Configuration', {
                            serviceId,
                            templateId,
                            timestamp: new Date().toISOString()
                        });
                        
                        debugLog('Template Variables', {
                            ...clientEmailParams,
                            email: '[HIDDEN]',
                            to_email: '[HIDDEN]',
                            from_email: '[HIDDEN]'
                        });

                        // Clean and validate client email parameters
                        const cleanClientParams = {
                            // Essential EmailJS fields
                            from_name: 'Starkville Adventures',
                            from_email: 'notifications@starkvilleadventures.co.ke',
                            to_name: String(clientEmailParams.to_name || '').trim(),
                            to_email: String(clientEmail).trim(),
                            email: String(clientEmail).trim(), // Add email field explicitly
                            reply_to: 'support@starkvilleadventures.co.ke',
                            subject: `Your ${formType} Quote Request - Starkville Adventures`,
                            
                            // Template content fields
                            destination: String(clientEmailParams.destination || 'Not specified').trim(),
                            travel_dates: String(clientEmailParams.travel_dates || 'Not specified').trim(),
                            duration: String(clientEmailParams.duration || 'Not specified').trim(),
                            group_size: String(clientEmailParams.group_size || '0').trim(),
                            activities: String(clientEmailParams.activities || 'Not specified').trim(),
                            special_requirements: String(clientEmailParams.special_requirements || 'None').trim(),
                            accommodation_type: String(clientEmailParams.accommodation_type || 'Standard').trim(),
                            
                            // Additional fields
                            logo_url: 'https://res.cloudinary.com/dwpr0xrjq/image/upload/v1758725534/LOGO_WHITE_BG_harwpu.png',
                            request_type: String(formType).trim(),
                            date: new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })
                        };

                        // Log the exact parameters being sent
                        console.log('Sending client email with params:', {
                            ...cleanClientParams,
                            to_email: '[HIDDEN]'
                        });

                        // Add required template variables if missing
                        if (!cleanClientParams.to_email) {
                            console.error('Missing to_email in cleanClientParams');
                            throw new Error('Recipient email address is required');
                        }

                        const clientResult = await emailjs.send(
                            'service_0ubfwfr',
                            'template_7a5okfl', // Updated template ID from EmailJS
                            cleanClientParams
                        );
                        debugLog('Client Confirmation Success', {
                            status: clientResult.status,
                            text: clientResult.text,
                            timestamp: new Date().toISOString()
                        });
                        console.groupEnd();
                    } catch (sendErr) {
                        console.error('Client confirmation send failed:', sendErr);
                        // don't stop the whole workflow — rethrow so the outer catch shows an error dialog
                        throw sendErr;
                    }
                }

                // 3. Send copy to support
                const supportEmailParams = {
                    ...emailParams,
                    to_email: 'support@starkvilleadventures.co.ke',
                    to: 'support@starkvilleadventures.co.ke',
                    recipient_email: 'support@starkvilleadventures.co.ke',
                    recipient: 'support@starkvilleadventures.co.ke',
                    subject: ` New ${formType} Request`
                };
                
                console.log('Sending support copy...');
                console.log('Support Email Parameters:', supportEmailParams);
                try {
                    const supportResult = await emailjs.send(
                        'service_0ubfwfr',
                        'template_hecn3gx',
                        supportEmailParams
                    );
                    console.log('Support copy sent:', supportResult);
                } catch (sendErr) {
                    console.error('Support copy send failed:', sendErr);
                    throw sendErr;
                }

                // Show loading dialog
                const loadingDialog = document.createElement('div');
                loadingDialog.className = 'confirmation-dialog loading';
                loadingDialog.innerHTML = `
                    <div class="dialog-content">
                        <div class="loading-spinner"></div>
                        <p>Sending your request...</p>
                    </div>
                `;
                document.body.appendChild(loadingDialog);

                // Simulate sending request (replace with actual API endpoint)
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Remove loading dialog
                document.body.removeChild(loadingDialog);

                // Show enhanced success dialog
                const successDialog = document.createElement('div');
                successDialog.className = 'confirmation-dialog success';
                successDialog.innerHTML = `
                    <div class="dialog-content">
                        <div class="success-icon">✓</div>
                        <h3>Quote Request Received!</h3>
                        <p>Thank you for your interest in Starkville Adventures.</p>
                        <p>We will contact you via <strong>${clientEmail}</strong>.</p>
                        <p>Our team will prepare your personalized quote within 24 hours.</p>
                        <div class="contact-info" style="margin: 15px 0; padding: 10px; background: #e8f5e9; border-radius: 4px;">
                            <p style="margin: 5px 0;"><strong>Need immediate assistance?</strong></p>
                            <p style="margin: 5px 0;">WhatsApp: +254 718265014</p>
                            <p style="margin: 5px 0;">Email: support@starkvilleadventures.co.ke</p>
                        </div>
                        <button onclick="this.closest('.confirmation-dialog').remove()">Close</button>
                    </div>
                `;
                document.body.appendChild(successDialog);

                return true;
            } catch (error) {
                console.error('Error submitting form:', error);

                // Remove any existing dialogs
                const existingDialog = document.querySelector('.confirmation-dialog');
                if (existingDialog) existingDialog.remove();

                // Determine friendly message
                let errorMessage = 'An unexpected error occurred. Please try again.';
                if (error && error.status === 422) {
                    errorMessage = 'Please ensure all required fields are filled correctly.';
                } else if (error && error.message) {
                    errorMessage = error.message;
                }

                // Create and show a single error dialog
                const errorDialog = document.createElement('div');
                errorDialog.className = 'confirmation-dialog error';
                errorDialog.innerHTML = `
                    <div class="dialog-content">
                        <div class="error-icon">❌</div>
                        <h3>Error Sending Request</h3>
                        <p>${errorMessage}</p>
                        <p>If the problem persists, please contact us at support@starkvilleadventures.co.ke</p>
                        <button onclick="this.closest('.confirmation-dialog').remove()">Close</button>
                    </div>
                `;
                document.body.appendChild(errorDialog);

                return false;
            }
        }

        // Add confirmation dialog styles
        const dialogStyles = document.createElement('style');
        dialogStyles.textContent = `
            .confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease-out;
            }

            .dialog-content {
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease-out;
            }

            .confirmation-dialog.loading .dialog-content {
                background: rgba(255, 255, 255, 0.95);
            }

            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #155834;
                border-radius: 50%;
                margin: 0 auto 20px;
                animation: spin 1s linear infinite;
            }

            .success-icon {
                width: 60px;
                height: 60px;
                background: #155834;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 30px;
                margin: 0 auto 20px;
            }

            .error-icon {
                width: 60px;
                height: 60px;
                background: #dc3545;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 30px;
                margin: 0 auto 20px;
            }

            .dialog-content h3 {
                color: #155834;
                margin: 0 0 15px;
                font-size: 24px;
            }

            .dialog-content p {
                color: #666;
                margin: 0 0 20px;
                line-height: 1.5;
            }

            .dialog-content button {
                background: linear-gradient(135deg, #FFD700, #155834);
                color: white;
                border: none;
                padding: 10px 25px;
                border-radius: 25px;
                font-size: 16px;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .dialog-content button:hover {
                transform: scale(1.05);
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(dialogStyles);

        // Hamburger menu functionality
        function toggleMenu() {
            const hamburger = document.querySelector('.hamburger');
            const navMenu = document.querySelector('.nav-menu');
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');

            // Close menu when a link is clicked
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                });
            });
        }

        // Events horizontal scroll functionality
        function scrollEvents(button, direction) {
            const section = button.closest('.quarter-section');
            const eventsGrid = section.querySelector('.events-grid');
            const scrollAmount = direction * 300; // Scroll one card width
            eventsGrid.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }

        // Modal booking logic
        document.addEventListener('DOMContentLoaded', function() {
            // Attach modal to body
            const modal = document.getElementById('bookingModal');
            const closeModalBtn = document.getElementById('closeModalBtn');
            const bookingBtns = document.querySelectorAll('.booking-btn');
            const modalTripTitle = document.getElementById('modalTripTitle');
            const modalTripDate = document.getElementById('modalTripDate');
            const modalTripPrice = document.getElementById('modalTripPrice');
            const modalTripDesc = document.getElementById('modalTripDesc');
            const modalAmount = document.getElementById('modalAmount');
            const modalPhone = document.getElementById('modalPhone');
            const modalConfirmDetails = document.getElementById('modalConfirmDetails');
            const modalBookingForm = document.getElementById('modalBookingForm');
            let currentTrip = {};
            const modalAdults = document.getElementById('modalAdults');
            const modalChildren = document.getElementById('modalChildren');

            // Helper to extract trip info from card
            function getTripInfo(card) {
                return {
                    title: card.querySelector('.event-title')?.textContent || '',
                    date: card.querySelector('.event-date')?.textContent || '',
                    price: card.querySelector('.event-price')?.textContent || '',
                    desc: card.querySelector('.event-description')?.textContent || ''
                };
            }

            // Currency handling functions
            const EXCHANGE_RATE = 129.5; // 1 USD = 129.5 KES

            function formatCurrency(amount, currency) {
                if (currency === 'USD') {
                    return `USD ${Number(amount).toFixed(2)}`;
                } else {
                    return `KES ${Number(amount).toFixed(2)}`;
                }
            }

            function convertCurrency(amount, fromCurrency, toCurrency) {
                console.log('Converting currency:', { amount, fromCurrency, toCurrency });

                // Validate amount
                if (isNaN(amount) || amount <= 0) {
                    console.error('Invalid amount for conversion:', amount);
                    return 0; // Return 0 for invalid amounts
                }

                if (fromCurrency === toCurrency) {
                    console.log('No conversion needed.');
                    return amount;
                }

                if (fromCurrency === 'KES' && toCurrency === 'USD') {
                    const converted = Number(amount) / EXCHANGE_RATE;
                    console.log('Converted KES to USD:', converted);
                    return converted;
                } else if (fromCurrency === 'USD' && toCurrency === 'KES') {
                    const converted = Number(amount) * EXCHANGE_RATE;
                    console.log('Converted USD to KES:', converted);
                    return converted;
                }

                console.error('Unsupported currency conversion:', fromCurrency, toCurrency);
                return amount;
            }

            // Open modal with trip info
            bookingBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    const card = btn.closest('.event-card');
                    if (!card) return;
                    currentTrip = getTripInfo(card);
                    modalTripTitle.textContent = currentTrip.title;
                    modalTripDate.textContent = currentTrip.date;
                    modalTripPrice.textContent = currentTrip.price;
                    modalTripDesc.textContent = currentTrip.desc;
                    
                    // Set default values
                    modalAdults.value = 1;
                    modalChildren.value = 0;
                    
                    // Set initial amount to 0
                    modalAmount.value = "0.00";
                    modalAmount.readOnly = true;
                    
                    // Trigger currency change to calculate proper amount
                    const selectedCurrency = modalBookingForm.currency.value;
                    modalBookingForm.currency.forEach(radio => {
                        if (radio.value === selectedCurrency) {
                            radio.dispatchEvent(new Event('change'));
                        }
                    });
                    
                    // Update currency display
                    document.getElementById('currencyDisplay').textContent = 
                        `Amount will be charged in ${selectedCurrency}`;
                    
                    updateConfirmDetails();
                    modal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                });
            });

            // Close modal only if there's no ongoing payment process
            let isProcessingPayment = false;
            
            closeModalBtn.addEventListener('click', function() {
                if (!isProcessingPayment) {
                    if (confirm('Are you sure you want to close? Any ongoing booking will be cancelled.')) {
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                } else {
                    alert('Please wait while payment is being processed...');
                }
            });
            
            // Prevent closing on outside click during payment processing
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (!isProcessingPayment) {
                        if (confirm('Are you sure you want to close? Any ongoing booking will be cancelled.')) {
                            modal.style.display = 'none';
                            document.body.style.overflow = '';
                        }
                    } else {
                        alert('Please wait while payment is being processed...');
                    }
                }
            });


            // Update amount and confirm details if adults/children/payment type changes

            function formatCurrency(amount, currency) {
                return currency === 'USD' ? 
                    `USD ${amount.toFixed(2)}` : 
                    `KES ${amount.toFixed(2)}`;
            }

            function convertCurrency(amount, fromCurrency, toCurrency) {
                console.log('Converting currency:', { amount, fromCurrency, toCurrency });

                // Validate amount
                if (isNaN(amount) || amount <= 0) {
                    console.error('Invalid amount for conversion:', amount);
                    return 0; // Return 0 for invalid amounts
                }

                if (fromCurrency === toCurrency) {
                    console.log('No conversion needed.');
                    return amount;
                }

                if (fromCurrency === 'KES' && toCurrency === 'USD') {
                    const converted = Number(amount) / EXCHANGE_RATE;
                    console.log('Converted KES to USD:', converted);
                    return converted;
                } else if (fromCurrency === 'USD' && toCurrency === 'KES') {
                    const converted = Number(amount) * EXCHANGE_RATE;
                    console.log('Converted USD to KES:', converted);
                    return converted;
                }

                console.error('Unsupported currency conversion:', fromCurrency, toCurrency);
                return amount;
            }

            // Add stricter validation to prevent concatenation of prices
            function recalcAmount() {
                console.log('Recalculating amount...');

                const priceStr = currentTrip.price || '';
                console.log('Original price string:', priceStr);

                const selectedCurrency = modalBookingForm.currency.value;
                console.log('Selected currency:', selectedCurrency);

                // Improved price parsing to avoid concatenation issues
                let usdPrice = parseFloat(priceStr.match(/USD \$(\d+(\.\d+)?)/)?.[1] || 0);
                let kesPrice = parseFloat(priceStr.match(/KES (\d+(,\d{3})*(\.\d+)?)/)?.[1]?.replace(/,/g, '') || 0);

                console.log('Parsed USD price:', usdPrice);
                console.log('Parsed KES price:', kesPrice);

                if (!usdPrice && !kesPrice) {
                    console.error('Failed to parse prices from string:', priceStr);
                    return;
                }

                // Ensure no concatenation of prices
                if (usdPrice > 0 && kesPrice > 0) {
                    console.log('Both USD and KES prices are valid. Using selected currency only.');
                    if (selectedCurrency === 'USD') {
                        kesPrice = 0; // Ignore KES price
                    } else {
                        usdPrice = 0; // Ignore USD price
                    }
                }

                console.log('Sanitized USD price:', usdPrice);
                console.log('Sanitized KES price:', kesPrice);

                if (!usdPrice && kesPrice) {
                    usdPrice = convertCurrency(kesPrice, 'KES', 'USD');
                    console.log('Converted KES to USD:', usdPrice);
                } else if (!kesPrice && usdPrice) {
                    kesPrice = convertCurrency(usdPrice, 'USD', 'KES');
                    console.log('Converted USD to KES:', kesPrice);
                }

                console.log('Final USD price:', usdPrice);
                console.log('Final KES price:', kesPrice);

                const adults = parseInt(modalAdults.value) || 0;
                const children = parseInt(modalChildren.value) || 0;
                console.log('Number of adults:', adults);
                console.log('Number of children:', children);

                const basePrice = selectedCurrency === 'USD' ? usdPrice : kesPrice;
                console.log('Base price in selected currency:', basePrice);

                // Calculate total with children at 70% of full price
                const adultTotal = basePrice * adults;
                const childrenTotal = basePrice * children * 0.7;
                const total = adultTotal + childrenTotal;

                console.log('Adult total:', adultTotal);
                console.log('Children total:', childrenTotal);
                console.log('Final total:', total);

                if (modalBookingForm.paymentType.value === 'full') {
                    modalAmount.value = Number(total).toFixed(2);
                    modalAmount.readOnly = true;
                } else {
                    modalAmount.value = '';
                    modalAmount.readOnly = false;
                }

                updateConfirmDetails();
            }
            modalAdults.addEventListener('input', recalcAmount);
            modalChildren.addEventListener('input', recalcAmount);
            modalBookingForm.paymentType.forEach(radio => {
                radio.addEventListener('change', recalcAmount);
            });

            // Add currency change handler
            modalBookingForm.currency.forEach(radio => {
                radio.addEventListener('change', () => {
                    const selectedCurrency = modalBookingForm.currency.value;
                    const priceStr = currentTrip.price || '';
                    
                    // Extract prices from the string
                    let usdPrice = parseFloat(priceStr.match(/USD \$(\d+(\.\d+)?)/)?.[1] || 0);
                    let kesPrice = parseFloat(priceStr.match(/KES (\d+(,\d{3})*(\.\d+)?)/)?.[1]?.replace(/,/g, '') || 0);

                    if (!usdPrice && kesPrice) {
                        usdPrice = convertCurrency(kesPrice, 'KES', 'USD');
                    } else if (!kesPrice && usdPrice) {
                        kesPrice = convertCurrency(usdPrice, 'USD', 'KES');
                    }

                    const adults = parseInt(modalAdults.value) || 0;
                    const children = parseInt(modalChildren.value) || 0;
                    
                    // Use the appropriate price based on selected currency
                    const basePrice = selectedCurrency === 'USD' ? usdPrice : kesPrice;
                    
                    // Calculate total with children at 70% of full price
                    const adultTotal = basePrice * adults;
                    const childrenTotal = basePrice * children * 0.7; // Children pay 70% of full price
                    const total = adultTotal + childrenTotal;
                    
                    // Update amount display
                    modalAmount.value = Number(total).toFixed(2);
                    
                    // Update currency display
                    document.getElementById('currencyDisplay').textContent = 
                        `Amount will be charged in ${selectedCurrency}`;
                    
                    updateConfirmDetails();
                });
            });
            // Set initial state
            modalAmount.readOnly = true;

            // Function to create participant name fields
            function updateParticipantFields() {
                const adults = parseInt(modalAdults.value) || 0;
                const children = parseInt(modalChildren.value) || 0;
                const participantsDiv = document.getElementById('participantNames') || (() => {
                    const div = document.createElement('div');
                    div.id = 'participantNames';
                    div.style.marginBottom = '1rem';
                    modalBookingForm.insertBefore(div, document.getElementById('modalConfirmDetails').parentElement);
                    return div;
                })();

                participantsDiv.innerHTML = '';
                
                if (adults + children > 1) { // Only show if there's more than one participant
                    const nameLabel = document.createElement('label');
                    nameLabel.style.fontWeight = '600';
                    nameLabel.style.color = '#155834';
                    nameLabel.textContent = 'Additional Participant Names:';
                    participantsDiv.appendChild(nameLabel);

                    // Create input fields for additional participants (excluding the main booker)
                    const totalExtra = adults + children - 1; // excluding main booker
                    const extraAdults = Math.max(0, adults - 1);
                    for (let i = 1; i <= totalExtra; i++) {
                        const wrapper = document.createElement('div');
                        wrapper.style.marginBottom = '0.5rem';
                        
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.required = true;
                        input.className = 'participant-name';
                        // determine role for this extra input: adult or minor
                        const idx = i - 1; // zero-based index into extras
                        const role = (idx < extraAdults) ? 'Adult' : 'Minor';
                        input.placeholder = `Participant ${i + 1} Name (${role})`;
                        // also add a small label indicating role
                        const roleLabel = document.createElement('div');
                        roleLabel.textContent = `${role}`;
                        roleLabel.style.fontSize = '0.85rem';
                        roleLabel.style.fontWeight = '600';
                        roleLabel.style.color = '#155834';
                        roleLabel.style.marginBottom = '4px';
                        input.style.width = '100%';
                        input.style.padding = '8px';
                        input.style.borderRadius = '6px';
                        input.style.border = '1px solid #ccc';
                        input.style.marginTop = '0.3rem';
                        
                        wrapper.appendChild(roleLabel);
                        wrapper.appendChild(input);
                        participantsDiv.appendChild(wrapper);
                    }
                }
                updateConfirmDetails();
            }

            // Update confirmation details on input
            function updateConfirmDetails() {
                let adults = parseInt(modalAdults.value) || 0;
                let children = parseInt(modalChildren.value) || 0;
                let totalPeople = adults + children;
                let amount = parseFloat(modalAmount.value) || 0;
                let selectedCurrency = modalBookingForm.currency.value;
                
                let participantNames = Array.from(document.querySelectorAll('.participant-name'))
                    .map(input => input.value.trim())
                    .filter(name => name)
                    .join('\n');
                
                // Extract price information correctly
                let priceStr = currentTrip.price || '';
                let origCurrency = priceStr.includes('USD') ? 'USD' : 'KES';
                let priceNum = 0;
if (origCurrency === 'USD') {
  priceNum = parseFloat(priceStr.match(/USD\s*\$?(\d+(?:\.\d+)?)/)?.[1] || 0);
} else {
  priceNum = parseFloat(priceStr.match(/KES\s*(\d+(?:,\d{3})*(?:\.\d+)?)/)?.[1]?.replace(/,/g, '') || 0);
}

                let convertedAmount = convertCurrency(priceNum, origCurrency, origCurrency === 'USD' ? 'KES' : 'USD');
                
                // Calculate totals for both currencies
                let usdTotal = (priceNum * adults) + (priceNum * 0.7 * children);
                let kesTotal = (convertedAmount * adults) + (convertedAmount * 0.7 * children);
                
                // Format the display amounts
                let displayAmount;
                if (modalBookingForm.paymentType.value === 'full') {
                    displayAmount = `KES ${kesTotal.toFixed(2)} (USD ${usdTotal.toFixed(2)})`;
                } else {
                    displayAmount = formatCurrency(amount, selectedCurrency);
                }

                modalConfirmDetails.textContent = `Trip: ${currentTrip.title}
Date: ${currentTrip.date}
Adults: ${adults} (Full Price)
Minors: ${children} (70% of Full Price)
Total People: ${totalPeople}
Amount to Pay: ${displayAmount}
Phone: ${modalPhone.value}${participantNames ? '\n\nAdditional Participants:\n' + participantNames : ''}`;
            }

            modalAmount.addEventListener('input', updateConfirmDetails);
            modalPhone.addEventListener('input', updateConfirmDetails);
            modalAdults.addEventListener('input', () => {
                updateParticipantFields();
                updateConfirmDetails();
            });
            modalChildren.addEventListener('input', () => {
                updateParticipantFields();
                updateConfirmDetails();
            });
            
            // Add event delegation for participant name inputs
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('participant-name')) {
                    updateConfirmDetails();
                }
            });

            // Handle form submit
            modalBookingForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Disable the submit button to prevent double submission
                const submitButton = modalBookingForm.querySelector('button[type="submit"]');
                const originalButtonText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.style.opacity = '0.7';
                submitButton.textContent = 'Processing...';

                const resetButton = () => {
                    submitButton.disabled = false;
                    submitButton.style.opacity = '1';
                    submitButton.textContent = originalButtonText;
                };

                // Validate full name
                const fullName = document.getElementById('modalFullName').value.trim();
                if (fullName.split(' ').length < 2) {
                    alert('Please enter at least two names');
                    document.getElementById('modalFullName').focus();
                    resetButton();
                    return;
                }
                // Validate phone
                const phone = modalPhone.value.trim();
                if (!/^((\+254|0)7\d{8})$/.test(phone)) {
                    alert('Please enter a valid Kenyan phone number (07XXXXXXXX or +2547XXXXXXXX)');
                    modalPhone.focus();
                    resetButton();
                    return;
                }
                // Validate amount
                const amount = parseFloat(modalAmount.value);
                if (!amount || amount < 1) {
                    alert('Please enter a valid amount.');
                    modalAmount.focus();
                    resetButton();
                    return;
                }

                // Validate participant names if there are additional participants
                const participantInputs = document.querySelectorAll('.participant-name');
                for (let input of participantInputs) {
                    if (!input.value.trim()) {
                        alert('Please enter names for all additional participants.');
                        input.focus();
                        resetButton();
                        return;
                    }
                    if (input.value.trim().split(' ').length < 2) {
                        alert('Please enter both first and last name for all participants.');
                        input.focus();
                        resetButton();
                        return;
                    }
                }

                // Create booking record - moved up from the removed document generation section
                
                // Collect participant names (additional inputs)
                const participantValues = Array.from(participantInputs).map(i => i.value.trim()).filter(Boolean);
                const adultsCount = parseInt(modalAdults.value) || 0;
                const childrenCount = parseInt(modalChildren.value) || 0;
                // Build adults and children name arrays. Assume main booker is one adult.
                const adultsNames = [];
                const childrenNames = [];
                if (adultsCount > 0) {
                    adultsNames.push(fullName);
                }
                // Additional adults = adultsCount - 1 (excluding main booker)
                const extraAdults = Math.max(0, adultsCount - 1);
                for (let i = 0; i < extraAdults; i++) {
                    if (participantValues[i]) adultsNames.push(participantValues[i]);
                }
                // Remaining inputs are children names
                for (let i = extraAdults; i < extraAdults + childrenCount; i++) {
                    if (participantValues[i]) childrenNames.push(participantValues[i]);
                }

                // Create booking record
                const bookingRecord = {
                    id: 'SA-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                    timestamp: new Date().toISOString(),
                    customerName: fullName,
                    phone: phone,
                    eventTitle: currentTrip.title,
                    eventDate: currentTrip.date,
                    adults: adultsCount,
                    children: childrenCount,
                    adultsNames: adultsNames,
                    childrenNames: childrenNames,
                    amount: amount,
                    paymentType: modalBookingForm.paymentType.value,
                    status: 'pending'
                };

                // Save to localStorage before processing
                try {
                    // Get existing bookings or initialize empty array
                    const existingBookings = JSON.parse(localStorage.getItem('starkvilleBookings')) || [];
                    existingBookings.push(bookingRecord);
                    localStorage.setItem('starkvilleBookings', JSON.stringify(existingBookings));
                    // Save last booking id so the STK handler can find the booking record
                    try { sessionStorage.setItem('lastBookingId', bookingRecord.id); } catch (e) { console.warn('Could not set sessionStorage', e); }
                } catch (e) {
                    console.error('Error saving to localStorage:', e);
                }

                // We've removed the local payment simulation so the real payment flow (M-PESA STK Push)
                // will handle the payment. Keep the booking record saved in localStorage and
                // re-enable the submit button so the STK handler can proceed.
                isProcessingPayment = false;
                resetButton();
                console.log('Booking saved. Proceeding with real payment flow (STK Push).');
                return;
            });
        });
        // Booking form tabs functionality
        document.addEventListener('DOMContentLoaded', function() {
            const tabBtns = document.querySelectorAll('.tab-btn');
            const bookingForms = document.querySelectorAll('.booking-form');

            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active class from all buttons and forms
                    tabBtns.forEach(b => b.classList.remove('active'));
                    bookingForms.forEach(f => f.classList.remove('active'));

                    // Add active class to clicked button and corresponding form
                    btn.classList.add('active');
                    const formId = btn.getAttribute('data-tab') + '-form';
                    document.getElementById(formId).classList.add('active');
                });
            });
        });

        // Navigation menu toggle
        function toggleMenu() {
            const navLinks = document.querySelector('.navbar ul');
            if (navLinks) navLinks.classList.toggle('active');
        }

        // Chatbot functionality
        function initChat() {
            const chatContainer = document.getElementById('chatContainer');
            const chatbotButton = document.getElementById('chatbotButton');
            
            if (chatbotButton) {
                chatbotButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (chatContainer) {
                        chatContainer.style.display = 'flex';
                        chatContainer.setAttribute('aria-hidden', 'false');
                    }
                });
            }

            if (chatContainer) {
                chatContainer.style.display = 'none';
                chatContainer.setAttribute('aria-hidden', 'true');

                // Close chat when clicking outside
                document.addEventListener('click', () => {
                    if (chatContainer.style.display === 'flex') {
                        chatContainer.style.display = 'none';
                        chatContainer.setAttribute('aria-hidden', 'true');
                    }
                });

                // Prevent closing when clicking inside chat
                chatContainer.addEventListener('click', (e) => e.stopPropagation());
            }
        }
        
        // Initialize chat when DOM is loaded
        document.addEventListener('DOMContentLoaded', initChat);

        // Custom cards horizontal scroll functionality
        function scrollCustomCards(button, direction) {
            const container = button.closest('.custom-quote-container');
            const cardsContainer = container.querySelector('.quote-cards');
            const scrollAmount = direction * 300; // Scroll one card width
            cardsContainer.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }

        // Quarter navigation functionality
        document.addEventListener('DOMContentLoaded', function() {
    // Show Q1 by default
    document.getElementById('q1').classList.add('active');
    document.querySelector('.quarter-nav a[href="#q1"]').classList.add('active');

    // Add click handlers to quarter navigation
    const quarterLinks = document.querySelectorAll('.quarter-nav a');
    quarterLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all sections and links
            document.querySelectorAll('.quarter-section').forEach(section => {
                section.classList.remove('active');
            });
            quarterLinks.forEach(link => {
                link.classList.remove('active');
            });

            // Add active class to clicked link and corresponding section
            this.classList.add('active');
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).classList.add('active');

            // Smooth scroll to section
            document.getElementById(targetId).scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
});
// --- M-PESA STK Push Payment Integration ---
document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.getElementById('modalBookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            // Get phone and amount
            const phone = document.getElementById('modalPhone').value.trim();
            const amount = document.getElementById('modalAmount').value.trim();

            // Basic validation
            if (!phone.match(/^\+?\d{10,15}$/)) {
                showPaymentMessage('Invalid phone number format. Please use 07XXXXXXXX or +2547XXXXXXXX.', false);
                return;
            }
            if (!amount || isNaN(amount) || Number(amount) < 1) {
                showPaymentMessage('Please enter a valid amount.', false);
                return;
            }

            showPaymentMessage('Sending payment request . Please check your phone...', true);

            try {
                const resp = await fetch('http://localhost:10000/stkpush', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: formatPhone(phone), amount: Number(amount) })
                });

                const data = await resp.json();

                if (!data || !data.success) {
                    showPaymentMessage('Failed to initiate payment: ' + (data && data.error ? data.error : 'Unknown error'), false);
                    return;
                }

                // Extract checkout/request id returned by our server
                const checkoutId = (data.mpesa && (data.mpesa.CheckoutRequestID || data.mpesa.checkoutRequestID)) || null;
                try { sessionStorage.setItem('lastCheckoutId', checkoutId); } catch (e) { /* ignore */ }
                console.log('STK push response:', data);
                if (!checkoutId) console.warn('No CheckoutRequestID returned by /stkpush response', data);

                // Create a visible status span for this checkout ID so SSE/polling can update it
                try {
                    const confirmDiv = document.getElementById('modalConfirmDetails');
                    if (checkoutId && confirmDiv) {
                        // Avoid duplicating
                        if (!document.getElementById('status-' + checkoutId)) {
                            const br = document.createElement('br');
                            const label = document.createElement('span');
                            label.textContent = 'Transaction status: ';
                            label.style.fontWeight = '600';
                            const statusSpan = document.createElement('span');
                            statusSpan.id = 'status-' + checkoutId;
                            statusSpan.textContent = 'pending';
                            statusSpan.style.cssText = 'display:inline-block;margin-left:8px;padding:4px 8px;border-radius:6px;background:#fff5e6;color:#915800;border:1px solid #ffdca8;';
                            confirmDiv.appendChild(br);
                            confirmDiv.appendChild(label);
                            confirmDiv.appendChild(statusSpan);
                        }
                    }
                } catch (err) {
                    console.warn('Could not create status span:', err);
                }
                if (!checkoutId) {
                    // If no checkout id, inform user and exit
                    showPaymentMessage('Payment request sent. Waiting for confirmation (no checkout id returned).', true);
                    return;
                }

                // Poll transaction status endpoint until we get a definitive result or timeout
                showPaymentMessage('Payment request sent. Waiting for confirmation...', true);

                const pollTransactionStatus = async (id, timeoutMs = 5 * 60 * 1000, intervalMs = 5000) => {
                    const start = Date.now();
                    while (Date.now() - start < timeoutMs) {
                        try {
                            const r = await fetch('http://localhost:10000/transaction-status/' + encodeURIComponent(id));
                            if (r.ok) {
                                const j = await r.json();
                                console.log('Polled transaction-status', id, j);
                                if (j && j.status && j.status !== 'pending' && j.status !== 'unknown') {
                                    return j;
                                }
                            }
                        } catch (err) {
                            console.error('Error polling transaction status:', err);
                        }
                        // wait
                        await new Promise(res => setTimeout(res, intervalMs));
                    }
                    return { status: 'timeout' };
                };

                const result = await pollTransactionStatus(checkoutId, 2 * 60 * 1000, 3000);

                // Find the booking record we saved earlier
                const lastBookingId = sessionStorage.getItem('lastBookingId');
                let bookings = [];
                try { bookings = JSON.parse(localStorage.getItem('starkvilleBookings')) || []; } catch (e) { bookings = []; }
                const bookingIndex = bookings.findIndex(b => b.id === lastBookingId);

                if (result.status === 'success') {
                    // update status span if present
                    try { if (checkoutId) updateStatusSpan(checkoutId, 'success'); } catch (e) {}
                    // Update booking status
                    if (bookingIndex >= 0) {
                        bookings[bookingIndex].status = 'confirmed';
                        localStorage.setItem('starkvilleBookings', JSON.stringify(bookings));
                    }
                    const booking = bookingIndex >= 0 ? bookings[bookingIndex] : null;
                    // Show final dialog, auto-download receipt and then reload the page
                    showFinalPaymentDialog('Payment successful. Your receipt will download automatically.', true, booking, result, checkoutId);
                } else if (result.status === 'failed' || result.status === 'cancelled') {
                    const desc = result.resultDesc || 'Payment was not completed.';
                    const booking = bookingIndex >= 0 ? bookings[bookingIndex] : null;
                    // Show failure in a dialog (no auto-reload)
                    showFinalPaymentDialog('Payment failed: ' + desc, false, booking, result, checkoutId);
                    try { if (checkoutId) updateStatusSpan(checkoutId, 'failed'); } catch (e) {}
                    if (bookingIndex >= 0) {
                        bookings[bookingIndex].status = 'failed';
                        localStorage.setItem('starkvilleBookings', JSON.stringify(bookings));
                    }
                } else if (result.status === 'timeout') {
                    // Allow user to re-check status manually when timeout occurs
                    showPaymentMessage('Payment confirmation timed out. You can re-check status or wait a few moments.', false);
                    const confirmDiv = document.getElementById('modalConfirmDetails');
                    if (confirmDiv) {
                        // remove existing button if present
                        const existing = document.getElementById('checkStatusBtn');
                        if (existing) existing.remove();
                        const btn = document.createElement('button');
                        btn.id = 'checkStatusBtn';
                        btn.textContent = 'Check payment status';
                        btn.style.cssText = 'margin-top:8px;padding:8px 12px;border-radius:6px;background:#FFD700;border:none;cursor:pointer;';
                        btn.onclick = async () => {
                            btn.disabled = true;
                            btn.textContent = 'Checking...';
                            const lastId = sessionStorage.getItem('lastCheckoutId') || checkoutId;
                            const res = await pollTransactionStatus(lastId, 5 * 60 * 1000, 5000);
                            if (res && res.status === 'success') {
                                try { if (lastId) updateStatusSpan(lastId, 'success'); } catch (e) {}
                                if (bookingIndex >= 0) {
                                    bookings[bookingIndex].status = 'confirmed';
                                    localStorage.setItem('starkvilleBookings', JSON.stringify(bookings));
                                }
                                const booking = bookingIndex >= 0 ? bookings[bookingIndex] : null;
                                showFinalPaymentDialog('Payment successful. Your receipt will download automatically.', true, booking, res, lastId);
                                if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
                            } else if (res && (res.status === 'failed' || res.status === 'cancelled')) {
                                try { if (lastId) updateStatusSpan(lastId, 'failed'); } catch (e) {}
                                const booking2 = bookingIndex >= 0 ? bookings[bookingIndex] : null;
                                showFinalPaymentDialog('Payment failed: ' + (res.resultDesc || ''), false, booking2, res, lastId);
                                if (bookingIndex >= 0) { bookings[bookingIndex].status = 'failed'; localStorage.setItem('starkvilleBookings', JSON.stringify(bookings)); }
                            } else if (res && res.status === 'timeout') {
                                showPaymentMessage('Still no confirmation. Please try again later or contact support.', false);
                                btn.disabled = false;
                                btn.textContent = 'Check payment status';
                            } else {
                                showPaymentMessage('Payment could not be confirmed. Please check your phone.', false);
                                btn.disabled = false;
                                btn.textContent = 'Check payment status';
                            }
                        };
                        confirmDiv.appendChild(btn);
                    }
                } else {
                    // unknown
                    showPaymentMessage('Payment could not be confirmed. Please check your phone.', false);
                }

            } catch (err) {
                console.error('Payment error:', err);
                // Final failure dialog (no auto-reload)
                showFinalPaymentDialog('Payment error: ' + (err && err.message ? err.message : 'An error occurred'), false, null, null, null);
            }
        });
    }
    // Helper to format phone to 2547XXXXXXXX
    function formatPhone(phone) {
        let p = phone.replace(/\D/g, '');
        if (p.startsWith('0')) p = '254' + p.slice(1);
        if (p.startsWith('7') && p.length === 9) p = '254' + p;
        if (p.startsWith('254') && p.length === 12) return p;
        return p;
    }
    // Helper to update a status span for a CheckoutRequestID
    function updateStatusSpan(checkoutId, status) {
        try {
            if (!checkoutId) return;
            const el = document.getElementById('status-' + checkoutId);
            if (el) {
                el.textContent = status;
                if (status === 'success') {
                    el.style.background = '#e6ffed';
                    el.style.color = '#0a6b2d';
                    el.style.border = '1px solid #8fe0a1';
                } else if (status === 'failed' || status === 'cancelled') {
                    el.style.background = '#ffe6e6';
                    el.style.color = '#a00';
                    el.style.border = '1px solid #f5a9a9';
                } else {
                    el.style.background = '#fff5e6';
                    el.style.color = '#915800';
                    el.style.border = '1px solid #ffdca8';
                }
            }
        } catch (err) { console.warn('updateStatusSpan error', err); }
    }

    // Small helper to escape HTML when injecting names into generated HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Format dates as dd/mm/yyyy for receipts
    function formatDateForReceipt(input) {
        const d = input ? new Date(input) : new Date();
        if (!d || isNaN(d.getTime())) return (input && String(input)) || '—';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    // Generate a simple PDF receipt for a confirmed booking
    function generateReceiptFromBooking(booking, transactionData) {
        try {
            // Extract mpesa receipt number if available
            let mpesaReceipt = '';
            try {
                const txn = transactionData || (window.lastTransactionData || null);
                if (txn) {
                    const cb = txn.callback || txn.Body || txn.body || txn;
                    const items = cb?.Body?.stkCallback?.CallbackMetadata?.Item || cb?.Body?.stkCallback?.CallbackMetadata || null;
                    if (Array.isArray(items)) {
                        const receiptItem = items.find(it => ((it.Name || it.name || '').toLowerCase().includes('mpesa') || (it.Name || it.name || '').toLowerCase().includes('receipt')) && (it.Value || it.value));
                        if (receiptItem) mpesaReceipt = receiptItem.Value || receiptItem.value || '';
                    }
                    if (!mpesaReceipt && cb?.Body?.stkCallback?.CallbackMetadata) {
                        const maybe = cb.Body.stkCallback.CallbackMetadata;
                        if (maybe && maybe.MpesaReceiptNumber) mpesaReceipt = maybe.MpesaReceiptNumber;
                    }
                }
            } catch (e) { console.warn('Could not extract mpesa receipt', e); }

            // Persist mpesa receipt on the booking for later reference
            try {
                if (mpesaReceipt) {
                    let bookings = JSON.parse(localStorage.getItem('starkvilleBookings')) || [];
                    const idx = bookings.findIndex(b => b.id === booking.id);
                    if (idx >= 0) {
                        bookings[idx].mpesaReceipt = mpesaReceipt;
                        localStorage.setItem('starkvilleBookings', JSON.stringify(bookings));
                    }
                }
            } catch (e) { console.warn('Could not persist mpesa receipt to booking', e); }

            // Build a styled HTML receipt element (matches provided design). We explicitly omit "Receipt ID" and "Checkout ID".
            const receiptEl = document.createElement('div');
            receiptEl.style.position = 'fixed';
            receiptEl.style.left = '-9999px';
            receiptEl.style.top = '0';
            receiptEl.id = 'starkville-temp-receipt';

            const participantsHtml = (() => {
                const adultsNames = Array.isArray(booking.adultsNames) ? booking.adultsNames : (booking.adultsNames ? booking.adultsNames.split('\n') : []);
                const childrenNames = Array.isArray(booking.childrenNames) ? booking.childrenNames : (booking.childrenNames ? booking.childrenNames.split('\n') : []);
                const adultsCount = booking.adults || adultsNames.length || 0;
                const childrenCount = booking.children || childrenNames.length || 0;

                const adultItems = adultsNames.length ? adultsNames.map(n => `<li>${escapeHtml(n)}</li>`).join('') : '<li>—</li>';
                const childItems = childrenNames.length ? childrenNames.map(n => `<li>${escapeHtml(n)}</li>`).join('') : '<li>—</li>';

                return `<h4>Adults (${adultsCount})</h4><ul>${adultItems}</ul><h4>Children (${childrenCount})</h4><ul>${childItems}</ul>`;
            })();

            const paidDate = formatDateForReceipt();
            const reference = (mpesaReceipt && mpesaReceipt.length > 0) ? mpesaReceipt : (booking.reference || booking.id || '—');

                        receiptEl.innerHTML = `
                            <div class="receipt-container">
                                <!-- stamp is an <img> so html2canvas can load it with CORS -->
                                <img class="stamp" data-src="https://res.cloudinary.com/dwpr0xrjq/image/upload/v1762802735/Starkville_stamp_zyprok.png" alt="stamp">
                                <div class="receipt-header">
                                    <img data-src="https://res.cloudinary.com/dwpr0xrjq/image/upload/v1758725534/LOGO_WHITE_BG_harwpu.png" alt="Starkville Adventures Logo" class="logo">
                  <div class="company-name">Starkville Adventures</div>
                  <div class="receipt-title">Booking Receipt</div>
                </div>
                <div class="receipt-body">
                  <div class="receipt-row"><div class="label">Reference:</div><div class="value">${reference}</div></div>
                  <div class="receipt-row"><div class="label">Date Paid:</div><div class="value">${paidDate}</div></div>
                  <div class="receipt-row"><div class="label">Paid by:</div><div class="value">${booking.customerName || '—'}</div></div>
                  <div class="receipt-row"><div class="label">Phone:</div><div class="value">${booking.phone || booking.msisdn || '—'}</div></div>
                  <div class="event-details">
                    <div class="event-title">Event Details</div>
                    <div class="receipt-row"><div class="label">Event:</div><div class="value">${booking.eventTitle || '—'}</div></div>
                    <div class="receipt-row"><div class="label">Event Date:</div><div class="value">${formatDateForReceipt(booking.eventDate)}</div></div>
                    <div class="participants">${participantsHtml}</div>
                  </div>
                  <div class="total-row"><div class="label">Total Amount:</div><div class="value">KSh ${Number(booking.amount || 0).toLocaleString()}</div></div>
                  <div class="thank-you">Thank you for choosing Starkville Adventures!</div>
                </div>
                <div class="receipt-footer">
                  <div class="social-links"><span class="social-link">Instagram</span> | <span class="social-link">TikTok</span> | <span class="social-link">Facebook</span></div>
                  <div class="contact-info">info@starkvilleadventures.co.ke<br>0718265014</div>
                </div>
              </div>
              <style>
                /* Minimal subset of the provided receipt CSS so html2canvas renders correctly */
                @import url('https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&display=swap');
                /* Receipt area width set to 150mm (fits within A4 with margins) */
                .receipt-container{position:relative;max-width:150mm;width:150mm;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 5px 15px rgba(0,0,0,0.1);font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif}
                .stamp{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);width:200px;height:200px;background-image:url('https://res.cloudinary.com/dwpr0xrjq/image/upload/v1762802735/Starkville_stamp_zyprok.png');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:0.12;z-index:0}
                .receipt-container>*:not(.stamp){position:relative;z-index:1}
                .receipt-header{background:#3d783c;color:#fff;padding:25px 20px;text-align:center}
                .logo{max-width:90px;margin-bottom:12px;border-radius:30%}
                .company-name{font-family:'Tangerine',cursive;font-size:36px;font-weight:700;letter-spacing:1px}
                .receipt-title{font-family:'Tangerine',cursive;font-size:26px;opacity:0.9;margin-top:5px}
                .receipt-body{padding:25px}
                .receipt-row{display:flex;justify-content:space-between;margin-bottom:15px;padding-bottom:15px;border-bottom:1px dashed #e0e0e0}
                .receipt-row:last-of-type{border-bottom:none}
                .label{font-weight:600;color:#555}
                .value{color:#333;text-align:right}
                .event-details{background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0}
                .event-title{font-family:'Tangerine',cursive;font-size:28px;font-weight:700;color:#2c3e50;margin-bottom:10px;text-align:center}
                .participants{margin-top:10px}
                .participants h4{color:#2c3e50;margin-bottom:5px}
                .participants ul{list-style:none;margin-left:10px;padding-left:0}
                .participants ul li{padding:3px 0;color:#333}
                .total-row{display:flex;justify-content:space-between;margin-top:20px;padding-top:15px;border-top:2px solid #2c3e50;font-size:18px;font-weight:700}
                .thank-you{text-align:center;margin:25px 0;font-size:16px;color:#2c3e50;font-weight:600}
                .receipt-footer{background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0}
                .social-link{display:inline-block;margin:0 8px;color:#2c3e50;font-weight:600}
                .contact-info{color:#666;line-height:1.6;font-size:14px}
              </style>
            `;

            document.body.appendChild(receiptEl);

            // Preload images (logo + stamp) with CORS enabled so html2canvas can render them
            const imgs = Array.from(receiptEl.querySelectorAll('img[data-src]'));
            const loadPromises = imgs.map(imgEl => {
                return new Promise(resolve => {
                    try {
                        imgEl.crossOrigin = 'anonymous';
                    } catch (e) {}
                    imgEl.onload = () => resolve();
                    imgEl.onerror = () => {
                        console.warn('Receipt image failed to load:', imgEl.dataset?.src || imgEl.src);
                        resolve();
                    };
                    // assign src last so crossOrigin is set before load starts
                    imgEl.src = imgEl.dataset.src;
                });
            });

            Promise.all(loadPromises).then(() => {
                // Render to canvas using html2canvas then save as A4 PDF via jsPDF with margins
                const canvasScale = 2;
                html2canvas(receiptEl, { scale: canvasScale, useCORS: true }).then(canvas => {
                try {
                    const imgData = canvas.toDataURL('image/png');
                    const { jsPDF } = window.jspdf;

                    // A4 page in mm
                    const A4_WIDTH_MM = 210;
                    const A4_HEIGHT_MM = 297;
                    const MARGIN_MM = 20; // per your requirement (20-30mm)
                    const printableWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;

                    // Convert canvas px -> element css px -> mm
                    const canvasWidthPx = canvas.width;
                    const canvasHeightPx = canvas.height;
                    // element css px width = canvas.width / scale
                    const elementCssPxWidth = canvasWidthPx / canvasScale;
                    const elementCssPxHeight = canvasHeightPx / canvasScale;
                    // convert CSS px to mm (1in = 96 CSS px, 1in = 25.4 mm)
                    const imgWidthMm = (elementCssPxWidth / 96) * 25.4;
                    const imgHeightMm = (elementCssPxHeight / 96) * 25.4;

                    // Fit image to printable width if needed
                    let renderWidthMm = imgWidthMm;
                    let renderHeightMm = imgHeightMm;
                    if (renderWidthMm > printableWidthMm) {
                        const ratio = printableWidthMm / renderWidthMm;
                        renderWidthMm = renderWidthMm * ratio;
                        renderHeightMm = renderHeightMm * ratio;
                    }

                    // Create A4 PDF and center the receipt horizontally, place at top margin
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                    const x = (A4_WIDTH_MM - renderWidthMm) / 2;
                    const availableHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2;

                    // if the rendered receipt fits on one page, add as before
                    if (renderHeightMm <= availableHeightMm) {
                        const y = MARGIN_MM;
                        pdf.addImage(imgData, 'PNG', x, y, renderWidthMm, renderHeightMm);
                    } else {
                        // Paginate vertically: slice the canvas into page-height chunks
                        // mmPerPx based on rendered width
                        const mmPerPx = renderWidthMm / canvasWidthPx;
                        const sliceHeightPx = Math.floor(availableHeightMm / mmPerPx);
                        let yPosPx = 0;
                        let page = 0;
                        while (yPosPx < canvasHeightPx) {
                            const hPx = Math.min(sliceHeightPx, canvasHeightPx - yPosPx);
                            // create temp canvas for slice
                            const tmp = document.createElement('canvas');
                            tmp.width = canvasWidthPx;
                            tmp.height = hPx;
                            const tctx = tmp.getContext('2d');
                            tctx.drawImage(canvas, 0, yPosPx, canvasWidthPx, hPx, 0, 0, canvasWidthPx, hPx);
                            const sliceData = tmp.toDataURL('image/png');
                            const sliceHeightMm = hPx * mmPerPx;
                            const y = MARGIN_MM;
                            if (page > 0) pdf.addPage();
                            pdf.addImage(sliceData, 'PNG', x, y, renderWidthMm, sliceHeightMm);
                            yPosPx += hPx;
                            page++;
                        }
                    }

                    const fileName = (mpesaReceipt && mpesaReceipt.length > 0) ? `Starkville-Receipt-${mpesaReceipt}.pdf` : `Starkville-Receipt-${booking.id || 'receipt'}.pdf`;
                    pdf.save(fileName);
                } catch (err) {
                    console.error('Error generating PDF from canvas', err);
                } finally {
                    // cleanup
                    const el = document.getElementById('starkville-temp-receipt');
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                }
            }).catch(err => {
                console.error('html2canvas error when creating receipt', err);
                const el = document.getElementById('starkville-temp-receipt');
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });

            });

        } catch (err) {
            console.error('Error creating PDF receipt:', err);
        }
    }

    // Show payment message in modal
    // Final confirmation dialog for success/failure
    function showFinalPaymentDialog(message, success, booking, transactionData, checkoutId) {
        // Remove any existing dialog
        const existing = document.querySelector('.confirmation-dialog.payment-result');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog payment-result ' + (success ? 'success' : 'error');
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="${success ? 'success-icon' : 'error-icon'}">${success ? '✓' : '❌'}</div>
                <h3>${success ? 'Payment Status' : 'Payment Issue'}</h3>
                <p>${message}</p>
                <div style="margin-top:18px; display:flex; gap:8px; justify-content:center;">
                    <button id="dialogCloseBtn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);


        // On success: always attempt to generate receipt and then reload the page
        if (success) {
            try {
                // If booking available, generate receipt from it; pass transactionData for Mpesa receipt extraction
                if (booking) {
                    try { generateReceiptFromBooking(booking, transactionData); } catch (e) { console.error('Receipt generation failed in dialog:', e); }
                } else {
                    // Attempt to find last booking from sessionStorage/localStorage as fallback
                    try {
                        const lastId = sessionStorage.getItem('lastBookingId');
                        const bookings = JSON.parse(localStorage.getItem('starkvilleBookings') || '[]') || [];
                        const b = bookings.find(x => x.id === lastId);
                        if (b) generateReceiptFromBooking(b, transactionData);
                    } catch (e) { /* ignore */ }
                }
            } catch (err) {
                console.error('Error auto-generating receipt:', err);
            }

            // Do NOT auto-reload here; the Close button will trigger a reload when clicked.
        }

        // Close button behavior: remove dialog; if this was a successful payment, reload the page
        const closeBtn = dialog.querySelector('#dialogCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            try { dialog.remove(); } catch (e) {}
            if (success) {
                try { location.reload(); } catch (e) { console.warn('Could not reload page:', e); }
            }
        });
    }

    // Show payment message in modal (for interim/info messages)
    function showPaymentMessage(msg, success) {
        let confirmDiv = document.getElementById('modalConfirmDetails');
        if (confirmDiv) {
            confirmDiv.textContent = msg;
            confirmDiv.style.background = success ? '#e6ffe6' : '#ffe6e6';
            confirmDiv.style.color = success ? '#155834' : '#c00';
        }
    }
});
// --- Server-Sent Events (SSE) client to receive live updates ---
try {
    const sseUrl = 'https://starkville.loca.lt/events';
    const eventSource = new EventSource(sseUrl);
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Transaction update (SSE):', data);

            // Flexible extraction of checkout/request id
            const checkoutId = data.checkoutId || data.CheckoutRequestID || (data.Body && data.Body.stkCallback && data.Body.stkCallback.CheckoutRequestID) || sessionStorage.getItem('lastCheckoutId');

            // Normalize status detection: server may send {status: 'success'} or full callback with ResultCode
            let status = (data.status || data.statusText || null);
            if (!status) {
                // Check common places for result codes
                const resultCode = data.resultCode ?? data.ResultCode ?? (data.Body && data.Body.stkCallback && data.Body.stkCallback.ResultCode);
                if (typeof resultCode !== 'undefined' && resultCode !== null) {
                    status = (Number(resultCode) === 0) ? 'success' : 'failed';
                }
            }

            // Also try ResultDesc if available for messages
            const resultDesc = data.resultDesc || data.ResultDesc || (data.Body && data.Body.stkCallback && data.Body.stkCallback.ResultDesc) || '';

            // Update status span when we have a checkoutId
            if (checkoutId) updateStatusSpan(checkoutId, status || 'pending');

            // If status is final, show dialog immediately and update booking
            if (status && (status === 'success' || status === 'failed' || status === 'cancelled')) {
                try {
                    const lastBookingId = sessionStorage.getItem('lastBookingId');
                    let bookings = [];
                    try { bookings = JSON.parse(localStorage.getItem('starkvilleBookings')) || []; } catch (e) { bookings = []; }
                    const bookingIndex = bookings.findIndex(b => b.id === lastBookingId);
                    const booking = bookingIndex >= 0 ? bookings[bookingIndex] : (bookings.length ? bookings[0] : null);

                    // Update booking status and persist
                    if (booking) {
                        if (status === 'success') bookings[bookingIndex >= 0 ? bookingIndex : 0].status = 'confirmed';
                        else bookings[bookingIndex >= 0 ? bookingIndex : 0].status = 'failed';
                        try { localStorage.setItem('starkvilleBookings', JSON.stringify(bookings)); } catch (e) { console.warn('Could not persist booking status', e); }
                    }

                    // Avoid duplicate dialogs
                    if (!document.querySelector('.confirmation-dialog.payment-result')) {
                        const friendly = status === 'success' ? 'Payment confirmed. Your receipt will download automatically.' : `Payment ${status}. ${resultDesc}`;
                        showFinalPaymentDialog(friendly, status === 'success', booking, data, checkoutId);
                    }
                } catch (e) {
                    console.error('Error handling SSE final status:', e);
                }
            }

        } catch (err) {
            console.error('Error parsing SSE message', err);
        }
    };
    eventSource.onerror = function(err) {
        console.error('SSE connection error to', sseUrl, err);
        // We keep polling fallback active; SSE is optional enhancement.
    };
} catch (err) {
    console.warn('SSE not available in this environment:', err);
}
    