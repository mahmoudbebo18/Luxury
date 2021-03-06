<?php

if ($_SERVER['REQUEST_METHOD'] == "POST") {
  //assign vars 

  $name =  filter_var($_POST['name'], FILTER_SANITIZE_STRING);  //filtring user input to include only strings 
  $email = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL); //filtring email input to include only email 
  $phone = filter_var($_POST['phone'], FILTER_SANITIZE_NUMBER_INT); //filtring phone input to include only phone 
  $message = filter_var($_POST['message'], FILTER_SANITIZE_STRING); //filtring message input to include only message 
  // array of errors 

  $formErrors = array();
  if (strlen($name) <= 3) {
    $formErrors[] = 'Name Must be More Than 3 Characters ';
  }
  if (strlen($message) < 10) {
    $formErrors[] = 'Message  Must be More Than 10 Characters ';
  }

  $headers = 'From : ' . $email . '\r\n';
  $myEmail = 'mahmoudelkhateb18@gmail.com';
  $subject = 'Contact Form';
  if (empty($formErrors)) {
    mail($myEmail, $subject, $message, $headers);
    $name = '';
    $email = '';
    $phone = '';
    $message = '';
    $success = '<div class="success-msg alert alert-success> 
            <h3> Thanks For Your Message  </h3>
            <p> We Will Back For You Soon  </p>
        </div>';
  }
}




?>


<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Meta for chorom inspect -->
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1" />
  <title>Mobile </title>
  <link rel="stylesheet" href="css/bootstrap.min.css">
  <link rel="stylesheet" href="css/all.min.css">
  <link rel="stylesheet" href="css/aos.css">
  <link rel="stylesheet" href="css/hamburgers.min.css">
  <link rel="stylesheet" href="css/style-en.css">
</head>

<body>
  <!-- start Nav -->
  <nav style="background-color: #4a5644;" class="navbar navbar-expand-lg navbar-light">
    <a class="navbar-brand" href="#">
      <img src="imgs/logo.svg" width="120px" height="50px" style="object-fit: cover" />
    </a>
    <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <i class="fas fa-bars"></i>
    </button>

    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <ul class="navbar-nav mr-auto">
        <li class="nav-item active">
          <a data-target="ab" class="nav-link" href="#">
            About Us <span class="sr-only">(current)</span></a>
        </li>

        <li class="nav-item">
          <a data-target="ms" class="nav-link" href="#">Our Message</a>
        </li>

        <li class="nav-item">
          <a data-target="vi" class="nav-link" href="#">Our Vesion</a>
        </li>
        <li class="nav-item logo-holder" style="padding: 0 !important">
          <a class="nav-link logo" href="#">
            <img src="imgs/logo.svg" width="150px" height="80px" style="object-fit: cover" />
          </a>
        </li>
        <li class="nav-item">
          <a data-target="wu" class="nav-link" href="#">Why Us </a>
        </li>

        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            Devisions
          </a>
          <div class="dropdown-menu" aria-labelledby="navbarDropdown">
            <a data-target="mc" class="dropdown-item" href="#">Members Club
            </a>
            <a data-target="ss" class="dropdown-item" href="services-en.html">
              Members Services</a>
          </div>
        </li>
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            <img src="imgs/england.png" width="20px" height="20px" />English
          </a>
          <div class="dropdown-menu" aria-labelledby="navbarDropdown">
            <a class="dropdown-item" href="index.html">
              <img src="imgs/arabic-flag.png" width="20px" height="20px" />Arabic
            </a>
          </div>
        </li>
      </ul>
    </div>
  </nav>

  <!--// End nav-->
  <!-- start join us -->

  <section class="join">
    <div class="container">
      <h2>Contact Us </h2>
      <p>Keep in Touch .... </p>
      <form class="text-right myForm" action=" <?php echo $_SERVER['PHP_SELF'] ?> " method="POST">

        <!-- server side validation  -->
        <?php if (!empty($formErrors)) { ?>
          <div class="alert alert-danger">
            <?php
            foreach ($formErrors as $error) {
              echo $error . '<br/>';
            }

            ?>

          </div>
        <?php } ?>

        <?php if (isset($success)) {
          echo $success;
        } ?>
        <div class="form-group">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-user" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="#a29061" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <circle cx="12" cy="7" r="4" />
            <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
          </svg>
          <input type="text" name="name" class="form-control userName" placeholder="Name" value="<?php if (isset($name)) {
                                                                                                    echo $name;
                                                                                                  } ?>">

          <div class="alert alert-danger my-alert">
            Name Must Be More Than 3 Characters
          </div>
        </div>
        <div class="form-group">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-at" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="#a29061" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <circle cx="12" cy="12" r="4" />
            <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0v-1.5a9 9 0 1 0 -5.5 8.28" />
          </svg>
          <input type="text" name="email" class="form-control myMail" placeholder="Email" value="<?php if (isset($email)) {
                                                                                                      echo $email;
                                                                                                    } ?>">

          <div class="alert alert-danger my-alert">
           Email Required
          </div>
        </div>
        <div class="form-group">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-device-mobile" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="#a29061" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <rect x="7" y="4" width="10" height="16" rx="1" />
            <line x1="11" y1="5" x2="13" y2="5" />
            <line x1="12" y1="17" x2="12" y2="17.01" />
          </svg>
          <input type="number" name="phone" class="form-control" placeholder="Phone" value="<?php if (isset($phone)) {
                                                                                                echo $phone;
                                                                                              } ?>">


        </div>
        <div class="form-group message">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-mail-forward" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="#a29061" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M12 18h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v7.5" />
            <path d="M3 6l9 6l9 -6" />
            <path d="M15 18h6" />
            <path d="M18 15l3 3l-3 3" />
          </svg>
          <textarea rows="4" name="message" class="form-control myMsg" placeholder="Message ">  <?php if (isset($message)) {
                                                                                                  echo $message;
                                                                                                } ?></textarea>



          <div class="alert alert-danger my-alert">
           Message Must Be More Than 10 Characters
          </div>
        </div>
        <div class="accept-terms d-flex">
          <input type="checkbox">
          <a href="terms .html">I Accept Terms And Conditions <i class="fas fa-arrow-right"></i> </a>
        </div>

        <button class="btn btn-primary form-control">Send</button>
      </form>
    </div>
  </section>

  <!-- end  join us -->

  <!-- footer-->
  <footer>
    <div class="footer-cont">
      <h3>?????????? ?????????????? </h3>
      <div class="download d-flex">
        <img src="imgs/app.svg" width="200px" height="60px">
        <img src="imgs/google.png" width="200px" height="60px">
      </div>
      <h2 class="h1 text-uppercase"> the <span>luxury club</span></h2>

      <div class="social">
        <i class="fab fa-instagram"></i>
        <i class="fab fa-twitter"></i> luxuryclub_sa
      </div>
      <div class="site-url">
        <a href="#">
          info@the-luxury-club.com </a> -
        <a href="#"> www.the-luxury-club.com</a>
      </div>

    </div>
  </footer>
  <script src="js/jquery-3.2.1.min.js"></script>
  <script src="js/popper.min.js"></script>
  <script src="js/bootstrap.min.js"></script>
  <script src="js/aos.js"></script>
  <script src="js/main.js"></script>
  <script>
    AOS.init();
  </script>
</body>

</html>