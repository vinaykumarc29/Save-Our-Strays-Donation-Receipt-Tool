import React, { useEffect, useReducer, useState } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "./barabari_logo.png";
import styles from "./App.module.scss";
import Input from "./Comps/Input/Input";
import { MdEmail } from "react-icons/md";
import { RiLockPasswordFill } from "react-icons/ri";
import { LuListStart } from "react-icons/lu";
import { LuListEnd } from "react-icons/lu";
import Lottie from "react-lottie-player";
import loaderAnimation from "./assets/lottie/loaderAnimation.json";
import classNames from "classnames";
import MultiEmailInput from "./Comps/MultiEmailInput/MultiEmailInput";
import encryptData from "../utils/encryptData";
// import linkedIn from "./assets/linkedIn.png";
// import instagram from "./assets/instagram.png"

type InputState = {
  starting: number | "";
  ending: number | "";
  email: string;
  password: string;
  ccEmails: string[];
  file: File | null;
  fileName: string;
};

type ErrorState = {
  emailError: string;
  passwordError: string;
  startingError: string;
  endingError: string;
};

type InputAction =
  | {
    type: "SET_FIELD";
    field: keyof Omit<InputState, "ccEmails">;
    value: string | number | File | null;
  }
  | { type: "SET_CC_EMAILS"; value: string[] }
  | { type: "SET_FILE"; value: File | null; fileName: string }
  | { type: "CLEAR_INPUTS" };

type ErrorAction =
  | { type: "SET_ERROR"; field: keyof ErrorState; value: string }
  | { type: "CLEAR_ERRORS" };

const initialInputState: InputState = {
  starting: "",
  ending: "",
  email: "",
  password: "",
  ccEmails: [],
  file: null,
  fileName: "",
};

const initialErrorState: ErrorState = {
  emailError: "",
  passwordError: "",
  startingError: "",
  endingError: "",
};

const inputReducer = (state: InputState, action: InputAction): InputState => {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
      };
    case "SET_CC_EMAILS":
      return {
        ...state,
        ccEmails: action.value,
      };
    case "SET_FILE":
      return {
        ...state,
        file: action.value,
        fileName: action.fileName,
      };
    case "CLEAR_INPUTS":
      return initialInputState;
    default:
      return state;
  }
};

const errorReducer = (state: ErrorState, action: ErrorAction): ErrorState => {
  switch (action.type) {
    case "SET_ERROR":
      return {
        ...state,
        [action.field]: action.value,
      };
    case "CLEAR_ERRORS":
      return initialErrorState;
    default:
      return state;
  }
};

const App: React.FC = () => {

  const [inputState, dispatchInput] = useReducer(
    inputReducer,
    initialInputState
  );

  const [errorState, dispatchError] = useReducer(
    errorReducer,
    initialErrorState
  );

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const awakeServer = async () => {
      try {
        await axios.get(import.meta.env.VITE_BACKEND_ENDPOINT as string);
      } catch (error) {
        toast.error("Internal Server Error | please contact to developers");
      }
    };
    awakeServer();
  }, []);

  const handleInputBlur = (fieldName: keyof InputState) => {
    validateInput(fieldName);
  };

  const validateInput = (fieldName: keyof InputState) => {
    dispatchError({ type: "CLEAR_ERRORS" });
    const value = inputState[fieldName] as string;
    let errorMessage = "";

    // Define variables outside the switch statement
    let starting: number, ending: number;

    switch (fieldName) {
      case "email":
        errorMessage =
          value && !/^\S+@\S+\.\S+$/.test(value)
            ? "Please provide a valid email address"
            : "";
        break;
      case "password":
        errorMessage = !value ? "Please provide a valid password" : "";
        break;
      case "starting":
        starting = parseInt(value, 10);
        errorMessage =
          !value || starting < 1
            ? "Please provide a valid starting row number"
            : "";
        break;
      case "ending":
        ending = parseInt(value, 10);
        errorMessage =
          !value || ending < 1 || ending < parseInt(inputState.starting as string, 10)
            ? "Please provide a valid ending row number"
            : "";
        break;
      default:
        break;
    }

    dispatchError({
      type: "SET_ERROR",
      field: `${fieldName}Error` as keyof ErrorState,
      value: errorMessage,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('we are going to handle file');
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      dispatchInput({ type: "SET_FILE", value: file, fileName: file.name });
    } else {
      console.log('we are here');
    }
  };

  const handleEmailsChange = (emails: string[]) => {
    dispatchInput({ type: "SET_CC_EMAILS", value: emails });
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    dispatchError({ type: "CLEAR_ERRORS" });

    const isEmailValid = /^\S+@\S+\.\S+$/.test(inputState.email);
    const starting = parseInt(inputState.starting as string, 10);
    const ending = parseInt(inputState.ending as string, 10);

    if (!inputState.email || !isEmailValid) {
      dispatchError({
        type: "SET_ERROR",
        field: "emailError",
        value: "Please provide a valid email address",
      });
      return;
    }
    if (!inputState.password) {
      dispatchError({
        type: "SET_ERROR",
        field: "passwordError",
        value: "Please provide a valid password",
      });
      return;
    }
    if (!starting || starting < 1) {
      dispatchError({
        type: "SET_ERROR",
        field: "startingError",
        value: "Please provide a valid starting row number",
      });
      return;
    }
    if (!ending || ending < 1) {
      dispatchError({
        type: "SET_ERROR",
        field: "endingError",
        value: "Please provide a valid ending row number",
      });
      return;
    }
    if (starting > ending) {
      dispatchError({
        type: "SET_ERROR",
        field: "startingError",
        value: "Starting row should be less than the ending row",
      });
      return;
    }
    if (!inputState.file) {
      toast.error("Please select a file");
      return;
    }
    try {
      setIsLoading(true);

      // Read the Excel file
      const data = await inputState.file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet
        // ,
        //    {
        //   raw: false,  // This ensures dates are parsed to JS date objects
        //   dateNF: 'mm-dd-yyyy',  // Define date format
        // }
      );
      const ExcelDateToJSDate = (date: number): string => {
        let convertedDate = new Date(Math.round((date - 25569) * 864e5));
        const dateString = convertedDate.toDateString().slice(4, 15);  // Extract the date portion
        const dateParts = dateString.split(" ");

        const day = dateParts[1];
        let month = dateParts[0];
        const year = dateParts[2];

        // Convert month name to number
        const monthNumber = ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(month) / 3 + 1).toString();
        const paddedMonth = monthNumber.length === 1 ? '0' + monthNumber : monthNumber;

        return `${day}/${paddedMonth}/${year.slice(2, 4)}`;
      };
      jsonData.map((data: any) => data['Date of Donation'] = ExcelDateToJSDate(data['Date of Donation']));
      const starting = Number(inputState.starting);
      const ending = Number(inputState.ending);
      const selectedRows = jsonData.slice(starting - 2, ending - 1);

      if (selectedRows.length == 0 || selectedRows.length != ((ending - starting) + 1)) {
        toast.error('Please Select a valid starting and ending row');
        return;
      }
      // console.log(selectedRows);
      const encryptedObj = encryptData({
        startingRowNo: starting,
        endingRowNo: ending,
        email: inputState.email,
        ccEmails: inputState.ccEmails,
        password: inputState.password,
        fileData: selectedRows // Include the Excel data in the payload
      });

      // Making the Axios call
      const response = await axios.post(import.meta.env.VITE_BACKEND_ENDPOINT as string, { encryptedData: encryptedObj });

      // // Handle success
      if (response.status === 200) {
        toast.success('Congratulations! The recipes have been sent successfully.');
      }
      else {
        toast.error('Encounter Error in sending mail please connect to the developer'); // error
      }
      dispatchInput({ type: "CLEAR_INPUTS" });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Specific handling for Axios errors
        if (error.response && error.response.data) {
          toast.error(error.response.data);
        } else {
          toast.error("Internal Server Error");
        }
      } else {
        // General error handling
        toast.error("An unexpected error occurred");
      }
      // console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.appBar}>
        <img src={logo} alt="Logo" className={styles.logo} />
        <h1 className={styles.title}>
          Save Our Strays x Barabari Donation Receipt Generator
        </h1>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.formBox}>
          <Input
            placeholder="Email Id"
            type="email"
            name="email"
            value={inputState.email}
            onChange={(e) =>
              dispatchInput({
                type: "SET_FIELD",
                field: "email",
                value: e.target.value,
              })
            }
            onBlur={() => handleInputBlur("email")}
            errorMessage={errorState.emailError}
            icon={<MdEmail />}
          />
          <Input
            placeholder="Password"
            type="password"
            name="password"
            value={inputState.password}
            onChange={(e) =>
              dispatchInput({
                type: "SET_FIELD",
                field: "password",
                value: e.target.value,
              })
            }
            onBlur={() => handleInputBlur("password")}
            errorMessage={errorState.passwordError}
            icon={<RiLockPasswordFill />}
          />
          <MultiEmailInput
            ccEmails={inputState.ccEmails}
            onEmailsChange={handleEmailsChange}
          />
          <Input
            placeholder="Starting Row"
            type="number"
            name="starting"
            value={inputState.starting}
            onChange={(e) =>
              dispatchInput({
                type: "SET_FIELD",
                field: "starting",
                value: parseInt(e.target.value),
              })
            }
            onBlur={() => handleInputBlur("starting")}
            errorMessage={errorState.startingError}
            icon={<LuListStart />}
          />
          <Input
            placeholder="Ending Row"
            type="number"
            name="ending"
            value={inputState.ending}
            onChange={(e) =>
              dispatchInput({
                type: "SET_FIELD",
                field: "ending",
                value: parseInt(e.target.value),
              })
            }
            onBlur={() => handleInputBlur("ending")}
            errorMessage={errorState.endingError}
            icon={<LuListEnd />}
          />
          <div className={styles.fileInputContainer}>
            {inputState.fileName && (
              <div className={styles.fileName}>{inputState.fileName}</div>
            )}
            <label htmlFor="file">Upload File</label>
            <input
              id="file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
          </div>
          <button
            className={classNames(
              styles.submitButton,
              isLoading && styles.loading
            )}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <Lottie
                animationData={loaderAnimation}
                style={{ width: 40, height: 20 }}
                loop
                play
              />
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Barabari Collective Developers.</p>
        <p>
          Built By
          <a
            href="https://www.linkedin.com/in/drumil-akhenia/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            Drumil Akhenia
          </a>
          &nbsp; & &nbsp;
          <a
            href="https://www.linkedin.com/in/deepak-undefined-8a68a927a/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            Deepak Sagar
          </a>
        </p>
        <p>
          Want us to build something for you?
          <a
            href="https://www.barabariproject.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            Contact us
          </a>
        </p>
      </footer>
      <ToastContainer
        autoClose={7000}
        newestOnTop={true}
        draggable
        theme="light"
      />
    </div>
  );
};

export default App;
