package expo.modules.qutaiauth

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sign in with Google on Android for pro-mode accounts (src/account/providers.ts): Credential Manager's
 * "Sign in with Google" button flow, which shows Google's account picker and returns an ID token.
 * The JavaScript side passes the server (web) client id and the nonce (the SHA-256 of the raw nonce the server
 * checks); the token is handed straight back and never stored here.
 */
class QutaiAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiAuth")

    AsyncFunction("googleSignIn") Coroutine { serverClientId: String, nonce: String ->
      val activity = appContext.currentActivity
        ?: throw CodedException("ERR_NO_ACTIVITY", "Qutai is not in the foreground.", null)
      val option = GetSignInWithGoogleOption.Builder(serverClientId).setNonce(nonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (e: GetCredentialCancellationException) {
        throw CodedException("ERR_CANCELED", describe(e), e)
      } catch (e: NoCredentialException) {
        throw CodedException("ERR_NO_CREDENTIAL", describe(e), e)
      } catch (e: GetCredentialException) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", describe(e), e)
      }
      if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", "TYPE_UNEXPECTED_CREDENTIAL: ${credential.type}", null)
      }
      try {
        mapOf("idToken" to GoogleIdTokenCredential.createFrom(credential.data).idToken)
      } catch (e: GoogleIdTokenParsingException) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", "TYPE_PARSING: the Google answer could not be read", e)
      }
    }
  }

  /**
   * "<exception type>: <message>" for the app's "Details" line (src/account/errorDetails.ts scrubs it further).
   * The type is the exception's stable `type` constant (e.g. TYPE_NO_CREDENTIAL, TYPE_UNKNOWN), not its class name,
   * which R8 may rename in a minified release. Google's own text usually names the cause, e.g. "During get sign-in
   * intent, failure response from one tap: 10: ..." (10 = DEVELOPER_ERROR: package name / SHA-1 / web client id
   * don't match the Google Cloud project; docs/google-sign-in.md). Never contains the token.
   */
  private fun describe(e: GetCredentialException): String =
    "${e.type.substringAfterLast('.')}: ${e.errorMessage ?: "no message"}".take(400)
}
