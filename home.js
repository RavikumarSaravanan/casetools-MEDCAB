document.getElementById('bookingForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const pickup = document.getElementById('pickupLocation').value;
    const destination = document.getElementById('destination').value;
    const type = document.getElementById('ambulanceType').value;
    const statusDiv = document.getElementById('statusMessage');

    statusDiv.innerHTML = 'Searching for ambulances...';

    // In a real implementation, you would send the actual form data
    // For now, we'll simulate a successful booking
    setTimeout(() => {
        statusDiv.innerHTML = 'Booking successful! Ambulance is on its way.';
        statusDiv.style.color = 'green';
    }, 2000);
    
    // Uncomment the following code when you want to connect to the backend:
    /*
    fetch('http://localhost:3000/api/book-ambulance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            patientName: 'John Doe', // You would get this from form fields
            contactNumber: '1234567890', // You would get this from form fields
            pickupAddress: pickup, 
            bookingDateTime: new Date(),
            ambulanceType: type 
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            statusDiv.innerHTML = `Booking successful! Booking ID: ${data.bookingId} is confirmed.`;
            statusDiv.style.color = 'green';
            
            // If driver is assigned, show driver details
            if (data.driver) {
                statusDiv.innerHTML += `<br>Driver: ${data.driver.name}<br>Vehicle: ${data.driver.vehicleNumber}<br>Contact: ${data.driver.contact}`;
            }
        } else {
            statusDiv.innerHTML = `Booking failed: ${data.message}`;
            statusDiv.style.color = 'red';
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        statusDiv.innerHTML = 'An error occurred. Please try again later.';
        statusDiv.style.color = 'red';
    });
    */
});